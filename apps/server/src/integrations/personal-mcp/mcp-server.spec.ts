import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ForbiddenException } from '@nestjs/common';
import { createNopetionMcp } from './mcp-server';
import { MCP_GUIDE } from './mcp-content';

async function connect(access: 'read' | 'write', tools: any) {
  const server = createNopetionMcp({ token: { access } } as any, tools);
  const client = new Client({ name: 'nopetion-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}
describe('Nopetion MCP contract', () => {
  it('exposes only three read tools for a read-only key and supplies the guide', async () => {
    const s = await connect('read', {});
    try {
      expect((await s.client.listTools()).tools.map((t) => t.name)).toEqual([
        'nopetion_list_spaces',
        'nopetion_search_pages',
        'nopetion_read_page',
      ]);
      const guide = await s.client.readResource({
        uri: 'nopetion://mcp/guide',
      });
      expect(guide.contents[0]['text']).toBe(MCP_GUIDE);
      expect(MCP_GUIDE).toContain('untrusted data');
      expect(
        (
          await s.client.callTool({
            name: 'nopetion_create_page',
            arguments: {},
          })
        ).isError,
      ).toBe(true);
    } finally {
      await s.close();
    }
  });
  it('exposes six correctly annotated tools for a write key', async () => {
    const s = await connect('write', {});
    try {
      const tools = (await s.client.listTools()).tools;
      expect(tools).toHaveLength(6);
      expect(
        tools.find((t) => t.name === 'nopetion_replace_block').annotations
          .destructiveHint,
      ).toBe(true);
      expect(
        tools.find((t) => t.name === 'nopetion_append_to_page').annotations
          .idempotentHint,
      ).toBe(true);
    } finally {
      await s.close();
    }
  });
  it('validates write arguments before invoking the domain service', async () => {
    const tools = { mutate: jest.fn() },
      s = await connect('write', tools);
    try {
      const r = await s.client.callTool({
        name: 'nopetion_append_to_page',
        arguments: {
          pageId: 'p',
          markdown: 'content',
          operationId: 'bad',
          expectedRevision: 'bad',
        },
      });
      expect(r.isError).toBe(true);
      expect(tools.mutate).not.toHaveBeenCalled();
    } finally {
      await s.close();
    }
  });
  it('returns permission failures without an internal stack or secret', async () => {
    const s = await connect('read', {
      listSpaces: jest
        .fn()
        .mockRejectedValue(new ForbiddenException('Space permission required')),
    });
    try {
      const r = await s.client.callTool({
        name: 'nopetion_list_spaces',
        arguments: {},
      });
      expect(r.isError).toBe(true);
      expect(r.content[0]['text']).toContain('403');
    } finally {
      await s.close();
    }
  });
  it('does not disclose unexpected database errors', async () => {
    const s = await connect('read', {
      listSpaces: jest
        .fn()
        .mockRejectedValue(new Error('private database credential')),
    });
    try {
      const r = await s.client.callTool({
        name: 'nopetion_list_spaces',
        arguments: {},
      });
      expect(r.isError).toBe(true);
      expect(JSON.stringify(r)).not.toContain('private database credential');
    } finally {
      await s.close();
    }
  });
  it('preserves significant Markdown indentation in block writes', async () => {
    const tools = { mutate: jest.fn().mockResolvedValue({ saved: true }) },
      s = await connect('write', tools);
    try {
      const markdown = '    const result = true;\n';
      const r = await s.client.callTool({
        name: 'nopetion_append_to_page',
        arguments: {
          pageId: 'page',
          markdown,
          operationId: 'a94005c6-6614-4f89-b3e7-279653bc6d54',
          expectedRevision: 'a'.repeat(64),
        },
      });
      expect(r.isError).not.toBe(true);
      expect(tools.mutate.mock.calls[0][1].markdown).toBe(markdown);
    } finally {
      await s.close();
    }
  });
});
