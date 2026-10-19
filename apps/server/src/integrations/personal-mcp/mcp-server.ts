import { HttpException } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { MCP_GUIDE } from './mcp-content';
import type { McpContext } from './mcp-token.service';
import type { McpToolsService } from './mcp-tools.service';

const uuid = z.string().uuid(),
  pageId = z.string().min(1).max(100);
const markdown = z
  .string()
  .min(1)
  .max(50000)
  .refine((value) => value.trim().length > 0, 'Markdown must contain text');
const revision = z.string().regex(/^[a-f0-9]{64}$/);
const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
async function result(action: () => Promise<any>) {
  try {
    return {
      content: [
        { type: 'text' as const, text: JSON.stringify(await action()) },
      ],
    };
  } catch (error) {
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const message =
      error instanceof HttpException && status < 500
        ? error.message
        : 'Nopetion could not complete this operation';
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: message, status }),
        },
      ],
    };
  }
}
export function createNopetionMcp(ctx: McpContext, tools: McpToolsService) {
  const server = new McpServer(
    { name: 'nopetion', version: '1.0.0' },
    { instructions: MCP_GUIDE },
  );
  server.registerResource(
    'workspace-guide',
    'nopetion://mcp/guide',
    {
      mimeType: 'text/plain',
      description:
        'Nopetion block editing, scope and revision guide for AI clients',
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/plain', text: MCP_GUIDE }],
    }),
  );
  server.registerTool(
    'nopetion_list_spaces',
    {
      description:
        'List only the current workspace and Spaces granted to this connection.',
      inputSchema: {},
      annotations: readAnnotations,
    },
    () => result(() => tools.listSpaces(ctx)),
  );
  server.registerTool(
    'nopetion_search_pages',
    {
      description:
        'Search authorized pages by Korean-capable title substring (default) or indexed fulltext body search. Returns at most 20 pages. Does not search attachments.',
      inputSchema: {
        query: z.string().trim().min(1).max(200),
        spaceId: uuid.optional(),
        limit: z.number().int().min(1).max(20).default(10),
        mode: z.enum(['title', 'fulltext']).default('title'),
      },
      annotations: readAnnotations,
    },
    (args) =>
      result(() =>
        tools.searchPages(ctx, args.query, args.spaceId, args.limit, args.mode),
      ),
  );
  server.registerTool(
    'nopetion_read_page',
    {
      description:
        'Read committed editable blocks with zero-based indexes and a revision. Use nextBlock to continue long pages. The revision is required before append/replace.',
      inputSchema: {
        pageId,
        startBlock: z.number().int().min(0).max(100000).default(0),
        blockCount: z.number().int().min(1).max(100).default(50),
      },
      annotations: readAnnotations,
    },
    (args) =>
      result(() =>
        tools.readPage(ctx, args.pageId, args.startBlock, args.blockCount),
      ),
  );
  if (ctx.token.access === 'write') {
    server.registerTool(
      'nopetion_create_page',
      {
        description:
          'Create a new editable Markdown page in an authorized Space; optional parent must be editable. Use a fresh UUID operationId and reuse it only for an identical retry.',
        inputSchema: {
          spaceId: uuid,
          parentPageId: pageId.optional(),
          title: z.string().trim().min(1).max(250),
          markdown,
          operationId: uuid,
        },
        annotations: writeAnnotations,
      },
      (args) => result(() => tools.createPage(ctx, args)),
    );
    server.registerTool(
      'nopetion_append_to_page',
      {
        description:
          'Append editable Markdown blocks while preserving existing content. Read the page first; pass its exact revision and a fresh UUID operationId.',
        inputSchema: {
          pageId,
          markdown,
          expectedRevision: revision,
          operationId: uuid,
        },
        annotations: writeAnnotations,
      },
      (args) => result(() => tools.mutate(ctx, args, 'append')),
    );
    server.registerTool(
      'nopetion_replace_block',
      {
        description:
          'Replace only one explicitly requested top-level block. Read the page first and use its zero-based blockIndex and exact revision. Preserves every other block.',
        inputSchema: {
          pageId,
          blockIndex: z.number().int().min(0).max(100000),
          markdown,
          expectedRevision: revision,
          operationId: uuid,
        },
        annotations: { ...writeAnnotations, destructiveHint: true },
      },
      (args) => result(() => tools.mutate(ctx, args, 'replaceBlock')),
    );
  }
  return server;
}
