import { DB } from '@docmost/db/types/db';
import { PageEmbeddings } from '@docmost/db/types/embeddings.types';
import type { Generated, Timestamp } from './db';
import type { McpTokenTable, McpCreationTable } from './personal-mcp.types';
import type { PersonalAiJobTable } from './personal-ai-job.types';

export interface DbInterface extends DB {
  instanceSettings: {
    id: string; revision: number;
    value: import('kysely').ColumnType<import('../../integrations/server-settings/server-settings.schema').ServerSettings, string, string>;
  };
  personalClassificationConfigs: {
    workspaceId: string; ownerId: string; userId: string; enabled: boolean;
    rules: import('kysely').ColumnType<import('../../core/personal-classification/classification.rules').ClassificationRule[], string, string>;
    revision: string; updatedAt: Timestamp;
  };
  personalAiJobs: PersonalAiJobTable;
  personalMcpTokens: McpTokenTable;
  personalMcpCreations: McpCreationTable;
  pageEmbeddings: PageEmbeddings;
  personalReminders: {
    id: Generated<string>; userId: string; workspaceId: string; pageId: string; blockId: string;
    dueAt: Timestamp; deliveredAt: Timestamp | null; cancelledAt: Timestamp | null; createdAt: Generated<Timestamp>;
  };
  personalWorkspaces: {
    workspaceId: string;
    ownerId: string;
    userId: string;
    creationKey: string;
    createdAt: Generated<Timestamp>;
  };
  personalWorkspaceResets: {
    requestId: string;
    ownerId: string;
    removedWorkspaceIds: Generated<string[]>;
    createdAt: Generated<Timestamp>;
  };
  personalWorkspaceResetFiles: {
    id: Generated<string>;
    ownerId: string;
    filePath: string;
    createdAt: Generated<Timestamp>;
  };
}
