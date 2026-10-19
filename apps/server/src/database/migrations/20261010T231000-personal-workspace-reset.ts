import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.createTable('personal_workspace_resets')
    .addColumn('request_id', 'uuid', c => c.primaryKey())
    .addColumn('owner_id', 'uuid', c => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('removed_workspace_ids', sql`uuid[]`, c => c.notNull().defaultTo(sql`'{}'::uuid[]`))
    .addColumn('created_at', 'timestamptz', c => c.notNull().defaultTo(sql`now()`)).execute();
  // Transactional outbox: a failed file delete remains retryable after restart.
  await db.schema.createTable('personal_workspace_reset_files')
    .addColumn('id', 'uuid', c => c.primaryKey().defaultTo(sql`gen_uuid_v7()`))
    .addColumn('owner_id', 'uuid', c => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('file_path', 'varchar', c => c.notNull().unique())
    .addColumn('created_at', 'timestamptz', c => c.notNull().defaultTo(sql`now()`)).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('personal_workspace_reset_files').execute();
  await db.schema.dropTable('personal_workspace_resets').execute();
}
