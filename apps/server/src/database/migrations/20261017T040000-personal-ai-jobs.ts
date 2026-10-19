import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>) {
  await db.schema.createTable('personalAiJobs')
    .addColumn('id', 'uuid', c => c.primaryKey())
    .addColumn('ownerId', 'uuid', c => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('userId', 'uuid', c => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('workspaceId', 'uuid', c => c.notNull().references('workspaces.id').onDelete('cascade'))
    .addColumn('pageId', 'uuid', c => c.notNull().references('pages.id').onDelete('cascade'))
    .addColumn('fingerprint', 'varchar(64)', c => c.notNull())
    .addColumn('status', 'varchar(16)', c => c.notNull())
    .addColumn('payload', 'jsonb', c => c.notNull())
    .addColumn('resultText', 'text')
    .addColumn('resultBlocks', 'jsonb')
    .addColumn('errorCode', 'varchar(40)')
    .addColumn('writeAttempts', 'integer', c => c.notNull().defaultTo(0))
    .addColumn('createdAt', 'timestamptz', c => c.notNull().defaultTo(sql`now()`))
    .addColumn('updatedAt', 'timestamptz', c => c.notNull().defaultTo(sql`now()`))
    .addCheckConstraint('personal_ai_job_status', sql`status in ('queued','generating','applying','completed','conflict','failed')`)
    .execute();
  await db.schema.createIndex('personal_ai_job_active_page').on('personalAiJobs').column('pageId').unique()
    .where(sql<boolean>`status in ('queued','generating','applying')`).execute();
  await db.schema.createIndex('personal_ai_job_owner_page').on('personalAiJobs')
    .columns(['ownerId', 'workspaceId', 'pageId', 'createdAt']).execute();
}
export async function down(db: Kysely<any>) { await db.schema.dropTable('personalAiJobs').execute(); }
