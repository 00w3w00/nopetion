import { Kysely, sql } from 'kysely';
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('instanceSettings')
    .addColumn('id', 'varchar(32)', (c) => c.primaryKey())
    .addColumn('revision', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('value', 'jsonb', (c) => c.notNull().defaultTo(sql`'{}'::jsonb`))
    .addCheckConstraint(
      'instance_settings_value_object',
      sql`jsonb_typeof(value) = 'object'`,
    )
    .execute();
}
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('instanceSettings').execute();
}
