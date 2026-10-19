import { Kysely } from 'kysely';

// Keep a creation receipt even after its document is permanently removed.
// Retrying an old MCP request must never resurrect a deleted document.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('personalMcpCreations')
    .alterColumn('pageId', (c) => c.dropNotNull())
    .execute();
  await db.schema
    .alterTable('personalMcpCreations')
    .dropConstraint('personal_mcp_creations_page_id_fkey')
    .execute();
  await db.schema
    .alterTable('personalMcpCreations')
    .addForeignKeyConstraint(
      'personal_mcp_creation_page_ref',
      ['pageId'],
      'pages',
      ['id'],
    )
    .onDelete('set null')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('personalMcpCreations')
    .dropConstraint('personal_mcp_creation_page_ref')
    .execute();
  await db.schema
    .alterTable('personalMcpCreations')
    .addForeignKeyConstraint(
      'personal_mcp_creations_page_id_fkey',
      ['pageId'],
      'pages',
      ['id'],
    )
    .onDelete('cascade')
    .execute();
  // Existing tombstone receipts remain nullable rather than being deleted.
}
