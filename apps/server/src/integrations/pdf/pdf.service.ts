import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Optional,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { AttachmentRepo } from '@docmost/db/repos/attachment/attachment.repo';
import type { Page, User } from '@docmost/db/types/entity.types';
import { InjectKysely } from 'nestjs-kysely';
import type { KyselyDB } from '@docmost/db/types/kysely.types';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import { LOCAL_STORAGE_PATH } from '../../common/helpers';
import { StorageService } from '../storage/storage.service';
import { EnvironmentService } from '../environment/environment.service';
import { ServerSettingsService } from '../server-settings/server-settings.service';
import { ExportPdfDto } from './pdf.dto';
import { pdfMessages } from './pdf-languages';
import {
  pdfImage,
  PDF_LIMITS,
  renderPdf,
  validatePdfSource,
  type PdfImage,
  type PdfNode,
  type PdfSourceBudget,
} from './pdf-renderer';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export const pdfSourceHash = (value: unknown) =>
  createHash('sha256').update(canonical(value)).digest('hex');

@Injectable()
export class PdfService {
  private active = new Set<string>();
  constructor(
    private pages: PageRepo,
    private attachments: AttachmentRepo,
    private access: PageAccessService,
    private storage: StorageService,
    private environment: EnvironmentService,
    @InjectKysely() private db: KyselyDB,
    @Optional() private serverSettings?: ServerSettingsService,
  ) {}

  private limit(message: string): never {
    throw new BadRequestException({ code: 'pdfLimit', message });
  }

  private stale(): never {
    throw new ConflictException({ code: 'pdfStale', message: 'The selected documents changed. Refresh the selection and try again.' });
  }

  /** Bounded traversal avoids unbounded recursive SQL on corrupt/cyclic trees.
   * A denied parent hides its branch; neither titles nor hashes leak from it. */
  private async descendants(root: Page, user: User, wanted?: Set<string>) {
    const result: { page: Page; depth: number }[] = [];
    const seen = new Set([root.id]);
    let scanned = 0, sourceBytes = 0;
    const visit = async (parent: Page, depth: number) => {
      const children = await this.db.selectFrom('pages')
        .select(['id', 'title', 'parentPageId', 'spaceId', 'workspaceId', 'position', 'isBase', 'deletedAt', 'updatedAt'])
        .where('parentPageId', '=', parent.id).where('workspaceId', '=', user.workspaceId)
        .where('spaceId', '=', root.spaceId).where('deletedAt', 'is', null)
        .orderBy('position', (order) => order.collate('C').asc()).orderBy('id', 'asc')
        .limit(PDF_LIMITS.treeNodes + 1).execute();
      if (children.length && depth > PDF_LIMITS.treeDepth) this.limit('PDF document tree is too deep');
      for (const child of children) {
        if (++scanned > PDF_LIMITS.treeNodes) this.limit('PDF document tree is too large');
        if (seen.has(child.id)) this.limit('PDF document tree contains a cycle or duplicate');
        seen.add(child.id);
        let page: Page;
        try {
          await this.access.validateCanView(child as Page, user, true);
          if (child.isBase) continue;
          page = !wanted || wanted.has(child.id) ? await this.page(child.id, user, true) : child as Page;
        } catch (error) {
          if (error instanceof HttpException && [401, 403, 404].includes(error.getStatus())) continue;
          throw error;
        }
        if (page.isBase) continue;
        if (page.parentPageId !== parent.id || page.spaceId !== root.spaceId) this.stale();
        if (!wanted) {
          sourceBytes += Buffer.byteLength(JSON.stringify(page.content ?? {}));
          if (sourceBytes > PDF_LIMITS.text * 10) this.limit('PDF selection snapshots exceed the size limit');
          validatePdfSource(page.content);
        }
        result.push({ page, depth });
        await visit(page, depth + 1);
      }
    };
    await visit(root, 1);
    return result;
  }

  async tree(user: User, pageId: string) {
    if (this.active.has(user.id) || this.active.size >= 2)
      throw new ServiceUnavailableException({ code: 'pdfBusy', message: 'PDF export is busy. Try again shortly.' });
    this.active.add(user.id);
    try {
      const root = await this.page(pageId, user);
      if (root.isBase) this.limit('PDF export supports documents');
      const rows = await this.descendants(root, user);
      return { maxPages: PDF_LIMITS.documents, items: rows.map(({ page, depth }) => ({
        id: page.id, title: page.title || '', parentPageId: page.parentPageId, depth,
        sourceHash: pdfSourceHash(page.content), updatedAt: page.updatedAt,
      })) };
    } finally { this.active.delete(user.id); }
  }

  private async page(id: string, user: User, content = false): Promise<Page> {
    const page = await this.pages.findById(id, { includeContent: content });
    if (!page || page.workspaceId !== user.workspaceId || page.deletedAt)
      throw new NotFoundException();
    await this.access.validateCanView(page, user, true);
    return page;
  }

  private attachmentId(node: PdfNode): string | undefined {
    if (
      typeof node.attrs?.attachmentId === 'string' &&
      /^[a-f0-9-]{36}$/i.test(node.attrs.attachmentId)
    )
      return node.attrs.attachmentId;
    const src = node.attrs?.src;
    if (typeof src !== 'string') return;
    let pathname = src;
    if (!src.startsWith('/')) {
      try {
        const url = new URL(src);
        if (url.origin !== new URL(this.environment.getAppUrl()).origin) return;
        pathname = url.pathname;
      } catch {
        return;
      }
    }
    const base = new URL(this.environment.getAppUrl()).pathname.replace(/\/$/, '');
    if (base && pathname.startsWith(base + '/')) pathname = pathname.slice(base.length);
    return /^\/(?:api\/)?files\/([a-f0-9-]{36})\//i.exec(pathname)?.[1];
  }

  // This is deliberately narrower than normal storage reads: no links, paths
  // outside the storage root, special files, or oversized image decompression.
  private async readImage(path: string): Promise<Buffer> {
    if (this.storage.getDriverName() !== 'local')
      return this.storage.read(path);
    const root = await realpath(LOCAL_STORAGE_PATH);
    const full = resolve(root, path);
    const parent = await realpath(dirname(full));
    if (!full.startsWith(root + sep) || parent !== dirname(full))
      throw new Error('Invalid PDF image path');
    const file = await open(full, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > PDF_LIMITS.image)
        throw new Error('Invalid PDF image');
      return await file.readFile();
    } finally {
      await file.close();
    }
  }

  private async images(
    content: PdfNode,
    user: User,
    current: Page,
    budget: { total: number; cache: Map<string, PdfImage | undefined>; parents: Set<string> },
  ): Promise<Map<PdfNode, PdfImage>> {
    const images = new Map<PdfNode, PdfImage>();
    const cache = budget.cache;
    const pending = [content];
    while (pending.length) {
      const node = pending.pop()!;
      pending.push(...(node.content || []));
      if (node.type !== 'image') continue;
      const id = this.attachmentId(node);
      if (!id) continue; // External/data/file URLs are never fetched or opened.
      if (!cache.has(id)) {
        const attachment = await this.attachments.findById(id);
        if (
          !attachment ||
          attachment.workspaceId !== user.workspaceId ||
          attachment.deletedAt ||
          !attachment.pageId ||
          attachment.type !== 'file'
        )
          throw new NotFoundException();
        if (attachment.pageId !== current.id)
          await this.page(attachment.pageId, user);
        budget.parents.add(attachment.pageId);
        const expected = `${user.workspaceId}/files/${attachment.id}/${attachment.fileName}`;
        if (
          attachment.filePath !== expected ||
          !attachment.fileName ||
          /[/\\\0]/.test(attachment.fileName) ||
          ['.', '..'].includes(attachment.fileName)
        )
          throw new BadRequestException({
            code: 'pdfImage',
            message: 'Invalid PDF attachment path',
          });
        if (
          !['image/png', 'image/jpeg'].includes(attachment.mimeType) ||
          Number(attachment.fileSize) > PDF_LIMITS.image
        ) {
          cache.set(id, undefined);
          continue;
        }
        let image: PdfImage | undefined;
        try {
          image = pdfImage(await this.readImage(attachment.filePath));
        } catch {
          image = undefined;
        } // Missing/unsupported bytes get a visible marker.
        if (image) {
          budget.total += image.bytes.length;
          if (budget.total > PDF_LIMITS.images)
            throw new BadRequestException({
              code: 'pdfLimit',
              message: 'PDF images exceed the size limit',
            });
        }
        cache.set(id, image);
      }
      if (cache.get(id)) images.set(node, cache.get(id)!);
    }
    return images;
  }

  async export(
    user: User,
    dto: ExportPdfDto,
  ): Promise<{ title: string; buffer: Buffer }> {
    if (this.active.has(user.id) || this.active.size >= 2)
      throw new ServiceUnavailableException({
        code: 'pdfBusy',
        message: 'PDF export is busy. Try again shortly.',
      });
    this.active.add(user.id);
    try {
      const page = await this.page(dto.pageId, user, true);
      if (page.isBase)
        throw new BadRequestException({
          code: 'pdfSource',
          message: 'PDF export supports documents',
        });
      const selected = dto.selectedPages || [];
      if (selected.length + 1 > PDF_LIMITS.documents) this.limit('Too many PDF documents');
      const ids = new Set(selected.map((item) => item.pageId));
      if (ids.size !== selected.length || ids.has(page.id)) this.limit('Duplicate PDF document selection');
      const budget: PdfSourceBudget = { nodes: 0, text: 0 };
      const content = validatePdfSource(page.content, budget);
      if (
        (dto.sourceHash && dto.sourceHash !== pdfSourceHash(page.content)) ||
        (dto.title !== undefined && dto.title !== (page.title || ''))
      )
        throw new ConflictException({
          code: 'pdfStale',
          message: 'Wait for the current document to be saved before exporting',
        });
      const title = page.title || pdfMessages(user.locale).untitled;
      const descendants = selected.length ? await this.descendants(page, user, ids) : [];
      const documents = descendants.filter((item) => ids.has(item.page.id));
      if (documents.length !== selected.length) throw new NotFoundException();
      const expectations = new Map(selected.map((item) => [item.pageId, item]));
      for (const { page: child } of documents) {
        const expected = expectations.get(child.id)!;
        if (!/^[a-f0-9]{64}$/.test(expected.sourceHash || '') ||
            expected.sourceHash !== pdfSourceHash(child.content) || expected.title !== (child.title || '')) this.stale();
      }
      const sections = [{ page, content, title }, ...documents.map(({ page: child }) => ({
        page: child, content: validatePdfSource(child.content, budget), title: child.title || pdfMessages(user.locale).untitled,
      }))];
      const imageBudget = { total: 0, cache: new Map<string, PdfImage | undefined>(), parents: new Set<string>() };
      const images = new Map<PdfNode, PdfImage>();
      for (const section of sections)
        for (const [node, image] of await this.images(section.content, user, section.page, imageBudget)) images.set(node, image);
      const settings = await this.serverSettings?.snapshot();
      let buffer = await renderPdf(title, content, images, user.locale, sections.slice(1));
      // Rendering can be slow. Recheck every selected document and its ancestry
      // before releasing bytes, including permission or tree changes mid-export.
      const recheck = async () => {
      for (const section of sections) {
        const fresh = await this.page(section.page.id, user, true);
        if (fresh.isBase || fresh.spaceId !== section.page.spaceId || fresh.parentPageId !== section.page.parentPageId ||
            fresh.title !== section.page.title || pdfSourceHash(fresh.content) !== pdfSourceHash(section.page.content)) this.stale();
      }
      if (selected.length) {
        const fresh = await this.descendants(page, user, ids);
        const freshIds = fresh.filter((item) => ids.has(item.page.id)).map((item) => item.page.id);
        if (freshIds.join() !== documents.map((item) => item.page.id).join()) this.stale();
      }
      for (const parentId of imageBudget.parents) await this.page(parentId, user);
      };
      await recheck();
      if (settings?.gotenbergUrl && this.serverSettings) {
        buffer = await this.serverSettings.processPdf(buffer, settings.revision);
        await recheck();
      }
      return { title, buffer };
    } finally {
      this.active.delete(user.id);
    }
  }
}
