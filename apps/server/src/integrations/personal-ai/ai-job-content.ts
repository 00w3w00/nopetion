import { BadRequestException } from '@nestjs/common';
import { getSchema } from '@tiptap/core';
import { randomUUID } from 'node:crypto';
import { aiTextToBlocks, safeAiBlocks } from '@docmost/editor-ext';
import { tiptapExtensions } from '../../collaboration/collaboration.util';
import { normalizeMcpContent } from '../personal-mcp/mcp-content';

export function validateAiSnapshot(value: Record<string, any>) {
  const stack: [unknown, number][] = [[value, 0]];
  let count = 0;
  while (stack.length) {
    const [node, depth] = stack.pop();
    if (++count > 50000 || depth > 64) throw new BadRequestException({ code: 'selection' });
    if (node && typeof node === 'object')
      for (const child of Object.values(node)) stack.push([child, depth + 1]);
  }
  if (Buffer.byteLength(JSON.stringify(value)) > 500000)
    throw new BadRequestException({ code: 'selection' });
  return normalizeMcpContent(value);
}

export function aiJobBlocks(text: string) {
  if (typeof text !== 'string' || !text.trim() || text.length > 20000)
    throw new BadRequestException({ code: 'incomplete' });
  const blocks = aiTextToBlocks(text);
  if (!safeAiBlocks(blocks)) throw new BadRequestException({ code: 'incomplete' });
  const node = getSchema(tiptapExtensions).nodeFromJSON(blocks);
  node.check();
  const normalized = node.toJSON();
  const visit = (item: any) => {
    if (item.attrs && Object.prototype.hasOwnProperty.call(item.attrs, 'id')) item.attrs.id = randomUUID();
    item.content?.forEach(visit);
  };
  visit(normalized);
  return normalized;
}
