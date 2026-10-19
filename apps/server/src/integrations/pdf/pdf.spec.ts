import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PdfService, pdfSourceHash } from './pdf.service';
import { pdfImage, renderPdf, validatePdfSource } from './pdf-renderer';
import { PdfController } from './pdf.controller';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import * as fsPromises from 'node:fs/promises';

jest.mock('./pdf-renderer', () => ({
  ...jest.requireActual('./pdf-renderer'),
  renderPdf: jest.fn(async () => Buffer.from('%PDF-1.3')),
}));

describe('independent PDF export authorization and safety', () => {
  afterEach(() => jest.restoreAllMocks());
  const user: any = { id: 'owner', workspaceId: 'workspace', locale: 'ko-KR' };
  const id = '11111111-1111-4111-8111-111111111111';
  let service: PdfService,
    page: any,
    attachment: any,
    pages: any,
    attachments: any,
    access: any,
    storage: any;
  const image = (attrs: Record<string, unknown>) => ({ type: 'image', attrs });
  beforeEach(() => {
    jest.clearAllMocks();
    page = {
      id: 'page',
      workspaceId: 'workspace',
      title: '한글 문서',
      content: { type: 'doc', content: [] },
    };
    attachment = {
      id,
      type: 'file',
      pageId: 'page',
      workspaceId: 'workspace',
      mimeType: 'image/png',
      fileName: 'image.png',
      filePath: `workspace/files/${id}/image.png`,
      fileSize: 68,
    };
    pages = {
      findById: jest.fn(async (key) =>
        key === 'page' ? page : { ...page, id: key },
      ),
    };
    attachments = { findById: jest.fn(async () => attachment) };
    access = { validateCanView: jest.fn(async () => undefined) };
    storage = {
      read: jest.fn(async () =>
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQWsAAAAASUVORK5CYII=',
          'base64',
        ),
      ),
      getDriverName: () => 's3',
    };
    service = new PdfService(pages, attachments, access, storage, {
      getAppUrl: () => 'http://localhost:3000',
    } as any, {} as any);
  });
  it('requires an authenticated session and current page access', async () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, PdfController)).toContain(
      JwtAuthGuard,
    );
    access.validateCanView.mockRejectedValue(new ForbiddenException());
    await expect(service.export(user, { pageId: 'page' })).rejects.toThrow(
      ForbiddenException,
    );
    expect(storage.read).not.toHaveBeenCalled();
    expect(renderPdf).not.toHaveBeenCalled();
  });
  it.each(['foreign', 'deleted'])(
    'rejects %s documents before attachment reads',
    async (kind) => {
      if (kind === 'foreign') page.workspaceId = 'elsewhere';
      else page.deletedAt = new Date();
      await expect(service.export(user, { pageId: 'page' })).rejects.toThrow(
        NotFoundException,
      );
      expect(storage.read).not.toHaveBeenCalled();
    },
  );
  it('checks saved body and title before rendering and releases failed export slots', async () => {
    await expect(
      service.export(user, { pageId: 'page', sourceHash: '0'.repeat(64) }),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.export(user, { pageId: 'page', title: 'unsaved title' }),
    ).rejects.toThrow(ConflictException);
    expect(renderPdf).not.toHaveBeenCalled();
    await service.export(user, {
      pageId: 'page',
      title: page.title,
      sourceHash: pdfSourceHash(page.content),
    });
    expect(renderPdf).toHaveBeenCalledTimes(1);
  });
  it('embeds only authorized storage bytes and keeps the source unmodified', async () => {
    const node = image({
      attachmentId: id,
      src: 'http://169.254.169.254/latest/meta-data',
      alt: '첨부 이미지',
    });
    page.content.content = [node];
    const before = JSON.stringify(page.content);
    await service.export(user, { pageId: 'page' });
    expect(storage.read).toHaveBeenCalledWith(attachment.filePath);
    const images = jest.mocked(renderPdf).mock.calls[0][2];
    expect(images.get(node)?.bytes).toBeInstanceOf(Buffer);
    expect(JSON.stringify(page.content)).toBe(before);
  });
  it.each([
    'http://169.254.169.254/latest/meta-data',
    'http://localhost:8080/secret',
    'file:///etc/passwd',
    '/etc/passwd',
    'data:image/png;base64,AAAA',
  ])('never resolves external or filesystem source %s', async (src) => {
    page.content.content = [image({ src })];
    await service.export(user, { pageId: 'page' });
    expect(attachments.findById).not.toHaveBeenCalled();
    expect(storage.read).not.toHaveBeenCalled();
    expect(jest.mocked(renderPdf).mock.calls[0][2].size).toBe(0);
  });
  it('checks the attachment parent permissions before reading bytes', async () => {
    page.content.content = [image({ attachmentId: id })];
    attachment.pageId = 'restricted-page';
    access.validateCanView.mockImplementation(async (candidate) => {
      if (candidate.id !== 'page') throw new ForbiddenException();
    });
    await expect(service.export(user, { pageId: 'page' })).rejects.toThrow(
      ForbiddenException,
    );
    expect(storage.read).not.toHaveBeenCalled();
  });
  it.each(['foreign', 'deleted', 'traversal', 'svg'])(
    'rejects or visibly omits an unsafe %s attachment',
    async (kind) => {
      page.content.content = [image({ attachmentId: id })];
      if (kind === 'foreign') attachment.workspaceId = 'other';
      if (kind === 'deleted') attachment.deletedAt = new Date();
      if (kind === 'traversal')
        attachment.filePath = `workspace/files/${id}/../../../../../etc/passwd`;
      if (kind === 'svg') attachment.mimeType = 'image/svg+xml';
      if (kind === 'svg') {
        await service.export(user, { pageId: 'page' });
        expect(jest.mocked(renderPdf).mock.calls[0][2].size).toBe(0);
      } else
        await expect(service.export(user, { pageId: 'page' })).rejects.toThrow(
          kind === 'traversal' ? BadRequestException : NotFoundException,
        );
      expect(storage.read).not.toHaveBeenCalled();
    },
  );
  it('does not follow a parent-directory symlink even within the storage root', async () => {
    page.content.content = [image({ attachmentId: id })];
    storage.getDriverName = () => 'local';
    jest
      .spyOn(fsPromises, 'realpath')
      .mockResolvedValueOnce('/pdf-test-storage')
      .mockResolvedValueOnce('/pdf-test-storage/restricted-page');
    const open = jest.spyOn(fsPromises, 'open');
    await service.export(user, { pageId: 'page' });
    expect(open).not.toHaveBeenCalled();
    expect(jest.mocked(renderPdf).mock.calls[0][2].size).toBe(0);
  });
  it('bounds concurrent work and recovers after completion', async () => {
    let resolve!: () => void;
    access.validateCanView.mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const first = service.export(user, { pageId: 'page' });
    await Promise.resolve();
    await Promise.resolve();
    await expect(service.export(user, { pageId: 'page' })).rejects.toThrow(
      ServiceUnavailableException,
    );
    resolve();
    await first;
    await expect(
      service.export(user, { pageId: 'page' }),
    ).resolves.toBeDefined();
  });
  it('refuses deep source nesting and oversized image decompression', () => {
    let doc: any = { type: 'text', text: 'deep' };
    for (let i = 0; i < 42; i++) doc = { type: 'doc', content: [doc] };
    expect(() => validatePdfSource(doc)).toThrow(BadRequestException);
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQWsAAAAASUVORK5CYII=',
      'base64',
    );
    png.writeUInt32BE(100000, 16);
    png.writeUInt32BE(100000, 20);
    expect(pdfImage(png)).toBeUndefined();
  });
});
