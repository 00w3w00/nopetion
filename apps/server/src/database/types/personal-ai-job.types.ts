import type { Generated } from 'kysely';

export type AiJobStatus = 'queued' | 'generating' | 'applying' | 'completed' | 'conflict' | 'failed';
export interface PersonalAiJobTable {
  id: string;
  ownerId: string;
  userId: string;
  workspaceId: string;
  pageId: string;
  fingerprint: string;
  status: AiJobStatus;
  payload: Record<string, any>;
  resultText: string | null;
  resultBlocks: Record<string, any> | null;
  errorCode: string | null;
  notificationHandledAt: Date | null;
  writeAttempts: Generated<number>;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}
