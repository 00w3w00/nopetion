import type { Generated } from 'kysely';

export interface McpTokenTable {
  id: string;
  ownerId: string;
  workspaceId: string;
  name: string;
  tokenHash: string;
  access: 'read' | 'write';
  spaceIds: string[];
  createdAt: Generated<Date>;
  expiresAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}
export interface McpCreationTable {
  tokenId: string;
  requestId: string;
  fingerprint: string;
  pageId: string | null;
}
