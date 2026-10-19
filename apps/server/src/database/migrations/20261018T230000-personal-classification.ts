import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.createTable('personalClassificationConfigs')
    .addColumn('workspaceId', 'uuid', c => c.primaryKey().references('workspaces.id').onDelete('cascade'))
    .addColumn('ownerId', 'uuid', c => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('userId', 'uuid', c => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('enabled', 'boolean', c => c.notNull().defaultTo(false))
    .addColumn('rules', 'jsonb', c => c.notNull())
    .addColumn('revision', 'uuid', c => c.notNull())
    .addColumn('updatedAt', 'timestamptz', c => c.notNull().defaultTo(sql`now()`))
    .execute();
}
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('personalClassificationConfigs').execute();
}
