import { Kysely, sql } from 'kysely';
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.createTable('personalReminders')
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_uuid_v7()`))
    .addColumn('userId', 'uuid', col => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('workspaceId', 'uuid', col => col.notNull().references('workspaces.id').onDelete('cascade'))
    .addColumn('pageId', 'uuid', col => col.notNull().references('pages.id').onDelete('cascade'))
    .addColumn('blockId', 'uuid', col => col.notNull())
    .addColumn('dueAt', 'timestamptz', col => col.notNull())
    .addColumn('deliveredAt', 'timestamptz')
    .addColumn('cancelledAt', 'timestamptz')
    .addColumn('createdAt', 'timestamptz', col => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('personal_reminder_block_owner', ['userId', 'pageId', 'blockId']).execute();
  await db.schema.createIndex('personal_reminder_due').on('personalReminders').column('dueAt')
    .where(sql<boolean>`delivered_at is null and cancelled_at is null`).execute();
}
export async function down(db: Kysely<any>): Promise<void> { await db.schema.dropTable('personalReminders').execute(); }
