import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import {
  MCP_OPERATION_MAP,
  mcpRevision,
} from '../integrations/personal-mcp/mcp-content';
import { prosemirrorNodeToYElement } from './collaboration.util';

export type McpMutation = {
  prosemirrorJson: any;
  operation: 'append' | 'replaceBlock' | 'insert';
  expectedRevision: string;
  blockIndex?: number;
  receiptKey: string;
  fingerprint: string;
};

/** Called synchronously inside the active document's Yjs transaction. */
export function applyMcpMutation(doc: Y.Doc, payload: McpMutation) {
  const content = TiptapTransformer.fromYdoc(doc, 'default');
  let revision: string;
  try { revision = mcpRevision(content); }
  catch { return { error: 'This document contains blocks unavailable to MCP; no blocks were changed' }; }
  const receipts = doc.getMap<any>(MCP_OPERATION_MAP),
    previous = receipts.get(payload.receiptKey);
  if (previous)
    return previous.fingerprint === payload.fingerprint
      ? { revision, replay: true }
      : { error: 'operationId already used for another request' };
  if (revision !== payload.expectedRevision)
    return { error: 'Stale revision; read the page again before editing' };
  const fragment = doc.getXmlFragment('default');
  if (
    payload.operation !== 'append' &&
    (!Number.isInteger(payload.blockIndex) ||
      payload.blockIndex < 0 ||
      payload.blockIndex > fragment.length - (payload.operation === 'replaceBlock' ? 1 : 0))
  )
    return { error: 'Block index unavailable; read the page again' };
  const elements = (payload.prosemirrorJson.content || []).map(
    prosemirrorNodeToYElement,
  );
  let position =
    payload.operation === 'append' ? fragment.length : payload.blockIndex;
  if (payload.operation === 'replaceBlock') fragment.delete(position, 1);
  if (payload.operation === 'insert' && fragment.length === 1 &&
      content.content?.[0]?.type === 'paragraph' && !content.content[0].content?.length) {
    fragment.delete(0, 1);
    position = 0;
  }
  fragment.insert(position, elements);
  const next = mcpRevision(TiptapTransformer.fromYdoc(doc, 'default'));
  receipts.set(payload.receiptKey, { fingerprint: payload.fingerprint });
  while (receipts.size > 1024) receipts.delete(receipts.keys().next().value);
  return { revision: next, replay: false };
}
