import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PdfService, pdfSourceHash } from './pdf.service';
import { ExportPdfDto } from './pdf.dto';
import * as renderer from './pdf-renderer';

jest.mock('./pdf-renderer', () => ({ ...jest.requireActual('./pdf-renderer'), renderPdf: jest.fn(async () => Buffer.from('%PDF')) }));

describe('selected descendant PDF documents', () => {
  const user: any = { id: 'owner', workspaceId: 'workspace', locale: 'ko-KR' };
  const doc = (text = '본문') => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
  let rows: any[], service: PdfService, access: any, storage: any, pages: any;
  const selection = (id: string) => { const p = rows.find(row => row.id === id); return { pageId: id, title: p.title, sourceHash: pdfSourceHash(p.content) }; };
  beforeEach(() => {
    jest.clearAllMocks();
    rows = [
      { id: 'root', parentPageId: null, position: 'a', title: '부모 문서', content: doc() },
      { id: 'later', parentPageId: 'root', position: 'b', title: '나중 문서', content: doc('뒤') },
      { id: 'first', parentPageId: 'root', position: 'a', title: '먼저 문서', content: doc('앞') },
      { id: 'nested', parentPageId: 'first', position: 'a', title: '중첩 문서', content: doc('중첩') },
      { id: 'sibling', parentPageId: null, position: 'c', title: '범위 밖', content: doc('범위 밖') },
    ].map(row => ({ ...row, spaceId: 'space', workspaceId: 'workspace', deletedAt: null, updatedAt: new Date() }));
    pages = { findById: jest.fn(async (id) => { const row = rows.find(p => p.id === id); return row && structuredClone(row); }) };
    access = { validateCanView: jest.fn(async () => undefined) };
    storage = { read: jest.fn(), getDriverName: () => 's3' };
    const db = { selectFrom: () => {
      const conditions: [string, unknown][] = []; let limit = 0;
      const query: any = { select: () => query, where: (key, _operator, value) => { conditions.push([key, value]); return query; }, orderBy: () => query,
        limit: (value) => { limit = value; return query; }, execute: async () => rows.filter(row => conditions.every(([key, value]) => row[key] === value))
          .sort((a, b) => a.position < b.position ? -1 : a.position > b.position ? 1 : a.id.localeCompare(b.id)).slice(0, limit).map(row => structuredClone(row)) };
      return query;
    } };
    service = new PdfService(pages, { findById: jest.fn() } as any, access, storage, { getAppUrl: () => 'http://localhost:3000' } as any, db as any);
  });
  afterEach(() => jest.restoreAllMocks());

  it('lists authorized descendants in preorder and omits the current page and unrelated siblings', async () => {
    const tree = await service.tree(user, 'root');
    expect(tree.maxPages).toBe(30);
    expect(tree.items.map(p => [p.id, p.depth])).toEqual([['first', 1], ['nested', 2], ['later', 1]]);
    expect(tree.items[0].sourceHash).toBe(pdfSourceHash(rows.find(p => p.id === 'first').content));
  });
  it('does not expose a denied parent or its descendants', async () => {
    access.validateCanView.mockImplementation(async (p) => { if (p.id === 'first') throw new ForbiddenException(); });
    expect((await service.tree(user, 'root')).items.map(p => p.id)).toEqual(['later']);
    expect(pages.findById).not.toHaveBeenCalledWith('nested', expect.anything());
    await expect(service.export(user, { pageId: 'root', selectedPages: [selection('nested')] })).rejects.toBeInstanceOf(NotFoundException);
    expect(renderer.renderPdf).not.toHaveBeenCalled();
  });
  it('uses fresh permission checks instead of a cached allow while listing descendants', async () => {
    access.validateCanView.mockImplementation(async (p, _user, fresh) => {
      if (p.id === 'first' && fresh === true) throw new ForbiddenException();
    });
    expect((await service.tree(user, 'root')).items.map(p => p.id)).toEqual(['later']);
  });
  it('does not release a merged PDF after a permission revocation hidden behind a cached allow', async () => {
    let revoked = false;
    access.validateCanView.mockImplementation(async (p, _user, fresh) => {
      if (revoked && p.id === 'first' && fresh === true) throw new ForbiddenException();
    });
    jest.mocked(renderer.renderPdf).mockImplementationOnce(async () => { revoked = true; return Buffer.from('%PDF'); });
    await expect(service.export(user, { pageId: 'root', selectedPages: [selection('first')] })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('always puts the current document first and follows real tree order, not request order', async () => {
    await service.export(user, { pageId: 'root', selectedPages: [selection('later'), selection('nested'), selection('first')] });
    const call = jest.mocked(renderer.renderPdf).mock.calls[0];
    expect(call[0]).toBe('부모 문서');
    expect(call[4]?.map(p => p.title)).toEqual(['먼저 문서', '중첩 문서', '나중 문서']);
  });
  it('keeps a single-document export independent of descendants', async () => {
    await service.export(user, { pageId: 'root' });
    expect(jest.mocked(renderer.renderPdf).mock.calls[0][4]).toEqual([]);
    expect(pages.findById.mock.calls.every(([id]) => id === 'root')).toBe(true);
  });
  it.each(['duplicate', 'root', 'outside', 'foreign', 'deleted'])('refuses %s selections before rendering', async (kind) => {
    let selected = [selection('first')];
    if (kind === 'duplicate') selected.push(selection('first'));
    if (kind === 'root') selected = [selection('root')];
    if (kind === 'outside') selected = [selection('sibling')];
    if (kind === 'foreign') rows.find(p => p.id === 'first').workspaceId = 'elsewhere';
    if (kind === 'deleted') rows.find(p => p.id === 'first').deletedAt = new Date();
    await expect(service.export(user, { pageId: 'root', selectedPages: selected })).rejects.toBeInstanceOf(kind === 'duplicate' || kind === 'root' ? BadRequestException : NotFoundException);
    expect(renderer.renderPdf).not.toHaveBeenCalled(); expect(storage.read).not.toHaveBeenCalled();
  });
  it.each(['body', 'title'])('refuses a selected child whose saved %s changed after selection', async (kind) => {
    const chosen = selection('first');
    rows.find(p => p.id === 'first')[kind === 'body' ? 'content' : 'title'] = kind === 'body' ? doc('새 내용') : '새 제목';
    await expect(service.export(user, { pageId: 'root', selectedPages: [chosen] })).rejects.toBeInstanceOf(ConflictException);
    expect(renderer.renderPdf).not.toHaveBeenCalled();
  });
  it.each(['body', 'title', 'move', 'permission'])('rechecks %s changes made while rendering before releasing bytes', async (kind) => {
    jest.mocked(renderer.renderPdf).mockImplementationOnce(async () => {
      const p = rows.find(row => row.id === 'first');
      if (kind === 'body') p.content = doc('렌더 중 변경');
      if (kind === 'title') p.title = '렌더 중 제목';
      if (kind === 'move') p.parentPageId = 'sibling';
      if (kind === 'permission') access.validateCanView.mockImplementation(async (candidate) => { if (candidate.id === 'first') throw new ForbiddenException(); });
      return Buffer.from('%PDF');
    });
    await expect(service.export(user, { pageId: 'root', selectedPages: [selection('first')] })).rejects.toBeInstanceOf(kind === 'permission' ? ForbiddenException : ConflictException);
  });
  it('detects cycles and bounds deep traversal without recursive SQL', async () => {
    rows.find(p => p.id === 'root').parentPageId = 'nested';
    await expect(service.tree(user, 'root')).rejects.toBeInstanceOf(BadRequestException);
    rows.find(p => p.id === 'root').parentPageId = null;
    for (let i = 0; i < 41; i++) rows.push({ ...rows[0], id: `depth-${i}`, parentPageId: i === 0 ? 'later' : `depth-${i - 1}` });
    await expect(service.tree(user, 'root')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('bounds both selected document count and total source size across documents', async () => {
    await expect(service.export(user, { pageId: 'root', selectedPages: Array.from({ length: 30 }, (_, i) => ({ ...selection('first'), pageId: `id-${i}` })) })).rejects.toBeInstanceOf(BadRequestException);
    rows.find(p => p.id === 'root').content = doc('가'.repeat(1_100_000));
    rows.find(p => p.id === 'first').content = doc('나'.repeat(1_100_000));
    await expect(service.export(user, { pageId: 'root', selectedPages: [selection('first')] })).rejects.toBeInstanceOf(BadRequestException);
    expect(renderer.renderPdf).not.toHaveBeenCalled();
  });
  it('bounds the descendant scan even when many siblings are not selected', async () => {
    for (let i = 0; i < 501; i++) rows.push({ ...rows[0], id: `wide-${i}`, parentPageId: 'root' });
    await expect(service.tree(user, 'root')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('counts authorized image bytes across the entire merged file, not separately per document', async () => {
    const ids = Array.from({ length: 5 }, (_, i) => `${String(i + 1).padStart(8, '0')}-1111-4111-8111-111111111111`);
    const images = (values: string[]) => ({ type: 'doc', content: values.map(attachmentId => ({ type: 'image', attrs: { attachmentId } })) });
    rows.find(p => p.id === 'root').content = images(ids.slice(0, 3));
    rows.find(p => p.id === 'first').content = images(ids.slice(3));
    const attachments = (service as any).attachments;
    attachments.findById.mockImplementation(async id => ({ id, pageId: 'root', workspaceId: 'workspace', type: 'file', fileName: 'image.png', filePath: `workspace/files/${id}/image.png`, mimeType: 'image/png', fileSize: 1 }));
    storage.read.mockResolvedValue(Buffer.from('authorized image'));
    jest.spyOn(renderer, 'pdfImage').mockReturnValue({ bytes: Buffer.alloc(renderer.PDF_LIMITS.image), width: 1, height: 1 });
    await expect(service.export(user, { pageId: 'root', selectedPages: [selection('first')] })).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.read).toHaveBeenCalledTimes(5); expect(renderer.renderPdf).not.toHaveBeenCalled();
  });
  it('validates nested HTTP selections, hashes, duplicate IDs and page limits', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    for (const selectedPages of [[null], [{ pageId: id, title: '', sourceHash: 'bad' }], Array(30).fill({ pageId: id, title: '', sourceHash: '0'.repeat(64) })]) {
      expect((await validate(plainToInstance(ExportPdfDto, { pageId: id, selectedPages }))).length).toBeGreaterThan(0);
    }
  });
});
