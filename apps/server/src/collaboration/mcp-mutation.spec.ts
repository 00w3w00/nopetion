import * as Y from 'yjs';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { applyMcpMutation, McpMutation } from './mcp-mutation';
import { tiptapExtensions } from './collaboration.util';
import {
  MCP_OPERATION_MAP,
  mcpRevision,
} from '../integrations/personal-mcp/mcp-content';

const paragraph = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});
const content = (doc: Y.Doc) => TiptapTransformer.fromYdoc(doc, 'default');
const make = () =>
  TiptapTransformer.toYdoc(
    {
      type: 'doc',
      content: [paragraph('보존할 원문'), paragraph('두 번째 블록')],
    },
    'default',
    tiptapExtensions,
  );
function request(doc: Y.Doc, extra: Partial<McpMutation> = {}): McpMutation {
  return {
    prosemirrorJson: { type: 'doc', content: [paragraph('MCP 추가 내용')] },
    expectedRevision: mcpRevision(content(doc)),
    operation: 'append',
    receiptKey: 'token:request',
    fingerprint: 'payload',
    ...extra,
  };
}
function apply(doc: Y.Doc, payload: McpMutation) {
  let result: ReturnType<typeof applyMcpMutation>;
  doc.transact(() => {
    result = applyMcpMutation(doc, payload);
  });
  return result;
}

describe('MCP collaborative block mutations', () => {
  it('inserts a background result after a captured block and preserves both neighbors', () => {
    const doc = make(), before = content(doc).content;
    const payload = request(doc, { operation: 'insert', blockIndex: 1 });
    expect(apply(doc, payload).error).toBeUndefined();
    expect(content(doc).content[0]).toEqual(before[0]);
    expect(content(doc).content[2]).toEqual(before[1]);
    expect(content(doc).content[1].content[0].text).toBe('MCP 추가 내용');
    expect(apply(doc, payload).replay).toBe(true);
    expect(content(doc).content).toHaveLength(3);
    doc.destroy();
  });
  it('replaces only a sole empty placeholder when writing a background result', () => {
    const doc = TiptapTransformer.toYdoc({ type: 'doc', content: [{ type: 'paragraph' }] }, 'default', tiptapExtensions);
    expect(apply(doc, request(doc, { operation: 'insert', blockIndex: 1 })).error).toBeUndefined();
    expect(content(doc).content).toHaveLength(1);
    expect(content(doc).content[0].content[0].text).toBe('MCP 추가 내용');
    doc.destroy();
  });
  it('refuses an unavailable background insertion index without deleting original blocks', () => {
    const doc = make(), before = content(doc);
    expect(apply(doc, request(doc, { operation: 'insert', blockIndex: 3 })).error).toMatch(/Block index/);
    expect(content(doc)).toEqual(before);
    doc.destroy();
  });
  it('never strips an unknown persisted node while calculating a revision', () => {
    const original = { type: 'doc', content: [{ type: 'legacyUnsupportedBlock', content: [paragraph('보존할 확장 내용')] }, paragraph('다음 블록')] };
    const before = JSON.stringify(original);
    expect(() => mcpRevision(original)).toThrow(/blocks unavailable to MCP/);
    expect(JSON.stringify(original)).toBe(before);
  });
  it('refuses a live document with an unknown block without changing its indexes', () => {
    const doc = make(), payload = request(doc, { operation: 'replaceBlock', blockIndex: 1 });
    doc.getXmlFragment('default').insert(0, [new Y.XmlElement('legacyUnsupportedBlock')]);
    const before = content(doc);
    expect(apply(doc, payload).error).toMatch(/blocks unavailable to MCP/);
    expect(content(doc)).toEqual(before); doc.destroy();
  });
  it('appends blocks while preserving the original nodes', () => {
    const doc = make(),
      original = content(doc).content;
    const result = apply(doc, request(doc));
    expect(content(doc).content.slice(0, 2)).toEqual(original);
    expect(content(doc).content[2].content[0].text).toBe('MCP 추가 내용');
    expect(result).toEqual({
      revision: mcpRevision(content(doc)),
      replay: false,
    });
    doc.destroy();
  });
  it('rejects a revision made stale by an unsaved collaborative edit', () => {
    const doc = make(),
      payload = request(doc),
      browser = new Y.Doc();
    Y.applyUpdate(browser, Y.encodeStateAsUpdate(doc));
    const first = browser.getXmlFragment('default').get(0);
    if (!(first instanceof Y.XmlElement))
      throw new Error('Expected a paragraph');
    first.insert(0, [new Y.XmlText('사용자 수정')]);
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(browser));
    const before = content(doc);
    expect(apply(doc, payload).error).toMatch(/Stale revision/);
    expect(content(doc)).toEqual(before);
    expect(doc.getMap(MCP_OPERATION_MAP).size).toBe(0);
    browser.destroy();
    doc.destroy();
  });
  it('replays an identical operation once, including after Ydoc serialization', () => {
    const doc = make(),
      payload = request(doc);
    apply(doc, payload);
    const reloaded = new Y.Doc();
    Y.applyUpdate(reloaded, Y.encodeStateAsUpdate(doc));
    expect(apply(reloaded, payload).replay).toBe(true);
    expect(content(reloaded).content).toHaveLength(3);
    reloaded.destroy();
    doc.destroy();
  });
  it('rejects operationId reuse for different content', () => {
    const doc = make(),
      payload = request(doc);
    apply(doc, payload);
    expect(
      apply(doc, { ...payload, fingerprint: 'another-intent' }).error,
    ).toMatch(/already used/);
    expect(content(doc).content).toHaveLength(3);
    doc.destroy();
  });
  it('replaces only the requested block and preserves both surrounding blocks', () => {
    const doc = make();
    apply(doc, request(doc));
    const before = content(doc).content;
    const payload = request(doc, {
      operation: 'replaceBlock',
      blockIndex: 1,
      receiptKey: 'token:second',
      prosemirrorJson: {
        type: 'doc',
        content: [paragraph('지정 블록만 교체')],
      },
    });
    expect(apply(doc, payload).error).toBeUndefined();
    const after = content(doc).content;
    expect(after[0]).toEqual(before[0]);
    expect(after[2]).toEqual(before[2]);
    expect(after[1].content[0].text).toBe('지정 블록만 교체');
    doc.destroy();
  });
  it.each([-1, 2, 1.5, undefined])(
    'rejects unavailable block index %s without deletion',
    (blockIndex) => {
      const doc = make(),
        before = content(doc);
      expect(
        apply(doc, request(doc, { operation: 'replaceBlock', blockIndex }))
          .error,
      ).toMatch(/Block index/);
      expect(content(doc)).toEqual(before);
      doc.destroy();
    },
  );
});
