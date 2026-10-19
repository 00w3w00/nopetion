import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import { PageService } from '../../core/page/services/page.service';
import { SearchService } from '../../core/search/search.service';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import { CollaborationGateway } from '../../collaboration/collaboration.gateway';
import { htmlToJson, jsonToNode } from '../../collaboration/collaboration.util';
import { markdownToHtml } from '@docmost/editor-ext';
import { McpContext, McpTokenService } from './mcp-token.service';
import { MCP_OPERATION_MAP, mcpFingerprint, mcpRevision, normalizeMcpContent } from './mcp-content';
import { sql } from 'kysely';
import { randomUUID } from 'node:crypto';
import * as Y from 'yjs';

export type McpWrite = {
  pageId: string;
  markdown: string;
  expectedRevision: string;
  operationId: string;
  blockIndex?: number;
};

@Injectable()
export class McpToolsService {
  constructor(
    private readonly tokens: McpTokenService,
    private readonly pages: PageRepo,
    private readonly spaces: SpaceRepo,
    private readonly pageService: PageService,
    private readonly search: SearchService,
    private readonly permissions: PageAccessService,
    private readonly abilities: SpaceAbilityFactory,
    private readonly collaboration: CollaborationGateway,
  ) {}

  private async active(ctx: McpContext, write = false) {
    const current = await this.tokens
      .database()
      .selectFrom('personalMcpTokens')
      .select(['revokedAt', 'expiresAt', 'access'])
      .where('id', '=', ctx.token.id)
      .executeTakeFirst();
    if (
      !current ||
      current.revokedAt ||
      new Date(current.expiresAt).getTime() <= Date.now()
    )
      throw new ForbiddenException('MCP key is no longer active');
    if (write && current.access !== 'write')
      throw new ForbiddenException('Read-only MCP key');
  }
  async space(ctx: McpContext, spaceId: string, action = SpaceCaslAction.Read) {
    if (!ctx.token.spaceIds.includes(spaceId))
      throw new NotFoundException('Space unavailable');
    const space = await this.spaces.findById(spaceId, ctx.workspace.id);
    if (!space || space.deletedAt)
      throw new NotFoundException('Space unavailable');
    const ability = await this.abilities.createForUser(ctx.user, spaceId);
    if (ability.cannot(action, SpaceCaslSubject.Page))
      throw new ForbiddenException('Space permission required');
    return space;
  }
  async listSpaces(ctx: McpContext) {
    await this.active(ctx);
    const spaces = [];
    for (const id of ctx.token.spaceIds) {
      try {
        const s = await this.space(ctx, id);
        spaces.push({ id: s.id, name: s.name, slug: s.slug });
      } catch (error) {
        if (
          !(
            error instanceof NotFoundException ||
            error instanceof ForbiddenException
          )
        )
          throw error;
      }
    }
    return {
      workspace: { id: ctx.workspace.id, name: ctx.workspace.name },
      access: ctx.token.access,
      spaces,
    };
  }
  async searchPages(
    ctx: McpContext,
    query: string,
    spaceId?: string,
    limit = 10,
    mode: 'title' | 'fulltext' = 'title',
  ) {
    const scope = await this.listSpaces(ctx);
    if (spaceId) await this.space(ctx, spaceId);
    const results = await Promise.all(
      scope.spaces
        .filter((s) => !spaceId || s.id === spaceId)
        .map(async (space) => {
          const result = await this.search.searchPage(
            { query, spaceId: space.id, titleOnly: mode === 'title', limit },
            { userId: ctx.user.id, workspaceId: ctx.workspace.id },
          );
          return result.items.map((p) => ({
            id: p.id,
            title: p.title,
            spaceId: space.id,
            updatedAt: p.updatedAt,
            url: this.pageUrl(space.slug, p.slugId),
            rank: p.rank,
          }));
        }),
    );
    const items = results
      .flat()
      .sort((a, b) => Number(b.rank) - Number(a.rank))
      .slice(0, limit)
      .map(({ rank: _rank, ...p }) => p);
    return { items, workspaceId: ctx.workspace.id, searchMode: mode, limit };
  }
  private pageUrl(spaceSlug: string, slugId: string) {
    return (
      this.tokens.endpoint().replace(/\/mcp$/, '') +
      `/s/${encodeURIComponent(spaceSlug)}/p/${slugId}`
    );
  }
  async page(ctx: McpContext, pageId: string, edit = false) {
    await this.active(ctx, edit);
    const page = await this.pages.findById(pageId, {
      includeContent: true,
      includeYdoc: edit,
    });
    if (
      !page ||
      page.deletedAt ||
      page.workspaceId !== ctx.workspace.id ||
      !ctx.token.spaceIds.includes(page.spaceId)
    )
      throw new NotFoundException('Page unavailable');
    await this.space(ctx, page.spaceId);
    if (edit) {
      if (page.isLocked) throw new ForbiddenException('Page is locked');
      await this.permissions.validateCanEdit(page, ctx.user);
    } else await this.permissions.validateCanView(page, ctx.user);
    return page;
  }
  async readPage(
    ctx: McpContext,
    pageId: string,
    startBlock = 0,
    blockCount = 50,
  ) {
    const page = await this.page(ctx, pageId),
      content = normalizeMcpContent(page.content);
    const blocks = (content.content || [])
      .slice(startBlock, startBlock + blockCount)
      .map((node: any, offset: number) => ({
        index: startBlock + offset,
        node,
      }));
    if (Buffer.byteLength(JSON.stringify(blocks)) > 500000)
      throw new BadRequestException(
        'Block slice too large; use a smaller blockCount',
      );
    const space = await this.space(ctx, page.spaceId);
    return {
      id: page.id,
      title: page.title,
      spaceId: page.spaceId,
      workspaceId: page.workspaceId,
      url: this.pageUrl(space.slug, page.slugId),
      revision: mcpRevision(page.content),
      snapshot: 'database-committed',
      totalBlocks: content.content?.length || 0,
      nextBlock:
        startBlock + blocks.length < (content.content?.length || 0)
          ? startBlock + blocks.length
          : null,
      blocks,
    };
  }
  private async markdown(markdown: string) {
    const doc = jsonToNode(htmlToJson(await markdownToHtml(markdown))).toJSON();
    for (const node of doc.content || []) {
      if (
        jsonToNode({ type: 'doc', content: [node] }).firstChild?.type.spec.attrs
          ?.id
      )
        node.attrs = { ...node.attrs, id: randomUUID() };
    }
    return doc;
  }
  async createPage(
    ctx: McpContext,
    input: {
      spaceId: string;
      parentPageId?: string;
      title: string;
      markdown: string;
      operationId: string;
    },
  ) {
    await this.active(ctx, true);
    await this.space(ctx, input.spaceId, SpaceCaslAction.Create);
    if (input.parentPageId) {
      const parent = await this.page(ctx, input.parentPageId, true);
      if (parent.spaceId !== input.spaceId)
        throw new NotFoundException('Parent page unavailable');
    }
    const fingerprint = mcpFingerprint(input),
      content = await this.markdown(input.markdown),
      db = this.tokens.database();
    const created = await db.transaction().execute(async (trx) => {
      await sql`select pg_advisory_xact_lock(hashtextextended(${ctx.token.id + ':' + input.operationId}, 0))`.execute(
        trx,
      );
      const token = await trx
        .selectFrom('personalMcpTokens')
        .select(['revokedAt', 'expiresAt'])
        .where('id', '=', ctx.token.id)
        .forShare()
        .executeTakeFirst();
      if (
        !token ||
        token.revokedAt ||
        new Date(token.expiresAt).getTime() <= Date.now()
      )
        throw new ForbiddenException('MCP key is no longer active');
      const previous = await trx
        .selectFrom('personalMcpCreations')
        .selectAll()
        .where('tokenId', '=', ctx.token.id)
        .where('requestId', '=', input.operationId)
        .executeTakeFirst();
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new ConflictException(
            'operationId already used for another request',
          );
        if (!previous.pageId)
          throw new NotFoundException(
            'The original document was deleted; this operation cannot recreate it',
          );
        return previous.pageId;
      }
      const page = await this.pageService.create(
        ctx.user.id,
        ctx.workspace.id,
        {
          spaceId: input.spaceId,
          parentPageId: input.parentPageId,
          title: input.title,
          content,
          format: 'json',
        },
        trx,
      );
      await trx
        .insertInto('personalMcpCreations')
        .values({
          tokenId: ctx.token.id,
          requestId: input.operationId,
          fingerprint,
          pageId: page.id,
        })
        .execute();
      return page.id;
    });
    return {
      ...(await this.readPage(ctx, created)),
      saved: true,
      operationId: input.operationId,
    };
  }
  async mutate(
    ctx: McpContext,
    input: McpWrite,
    operation: 'append' | 'replaceBlock',
  ) {
    const page = await this.page(ctx, input.pageId, true),
      content = await this.markdown(input.markdown);
    const receiptKey = ctx.token.id + ':' + input.operationId,
      fingerprint = mcpFingerprint({ ...input, operation });
    // Route to the current collaborative document owner, so unsaved browser edits
    // participate in the atomic revision check instead of being overwritten.
    const outcome = await this.collaboration.handleYjsEvent(
      'mcpMutateDocument',
      `page.${page.id}`,
      {
        user: ctx.user,
        prosemirrorJson: content,
        operation,
        expectedRevision: input.expectedRevision,
        blockIndex: input.blockIndex,
        receiptKey,
        fingerprint,
      },
    );
    if (!outcome || outcome.error)
      throw new ConflictException(
        outcome?.error || 'Collaboration is unavailable',
      );
    const committed = await this.pages.findById(page.id, {
      includeContent: true,
      includeYdoc: true,
    });
    const doc = new Y.Doc();
    try {
      if (committed?.ydoc) Y.applyUpdate(doc, new Uint8Array(committed.ydoc));
      const receipt = doc.getMap(MCP_OPERATION_MAP).get(receiptKey) as any;
      if (
        !receipt ||
        receipt.fingerprint !== fingerprint ||
        mcpRevision(committed?.content) !== outcome.revision
      )
        throw new ConflictException(
          'Database commit unconfirmed; read the page before retrying the same operationId',
        );
    } finally {
      doc.destroy();
    }
    return {
      id: page.id,
      saved: true,
      revision: outcome.revision,
      replay: outcome.replay,
      operationId: input.operationId,
    };
  }
}
