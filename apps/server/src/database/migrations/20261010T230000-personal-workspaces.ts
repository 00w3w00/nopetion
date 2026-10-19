import { Kysely, sql } from 'kysely';

// Additive: the original owner, workspace and documents stay in place.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.createTable('personal_workspaces')
    .addColumn('workspace_id', 'uuid', c => c.primaryKey().references('workspaces.id').onDelete('cascade'))
    .addColumn('owner_id', 'uuid', c => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('user_id', 'uuid', c => c.notNull().unique().references('users.id').onDelete('cascade'))
    .addColumn('creation_key', 'uuid', c => c.notNull())
    .addColumn('created_at', 'timestamptz', c => c.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('personal_workspaces_owner_creation_unique', ['owner_id', 'creation_key'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('personal_workspaces').execute();
}
