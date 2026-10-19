import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('personalMcpTokens')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('ownerId', 'uuid', (c) =>
      c.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('workspaceId', 'uuid', (c) =>
      c.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('name', 'varchar(64)', (c) => c.notNull())
    .addColumn('tokenHash', 'varchar(64)', (c) => c.notNull().unique())
    .addColumn('access', 'varchar(8)', (c) => c.notNull())
    .addColumn('spaceIds', sql`uuid[]`, (c) => c.notNull())
    .addColumn('createdAt', 'timestamptz', (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .addColumn('expiresAt', 'timestamptz', (c) => c.notNull())
    .addColumn('lastUsedAt', 'timestamptz')
    .addColumn('revokedAt', 'timestamptz')
    .addCheckConstraint('personal_mcp_access', sql`access in ('read', 'write')`)
    .execute();
  await db.schema
    .createIndex('personal_mcp_owner')
    .on('personalMcpTokens')
    .columns(['ownerId', 'workspaceId'])
    .execute();
  await db.schema
    .createTable('personalMcpCreations')
    .addColumn('tokenId', 'uuid', (c) =>
      c.notNull().references('personalMcpTokens.id').onDelete('cascade'),
    )
    .addColumn('requestId', 'uuid', (c) => c.notNull())
    .addColumn('fingerprint', 'varchar(64)', (c) => c.notNull())
    .addColumn('pageId', 'uuid', (c) =>
      c.notNull().references('pages.id').onDelete('cascade'),
    )
    .addPrimaryKeyConstraint('personal_mcp_creation_key', [
      'tokenId',
      'requestId',
    ])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('personalMcpCreations').execute();
  await db.schema.dropTable('personalMcpTokens').execute();
}
