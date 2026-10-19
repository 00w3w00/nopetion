import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>) {
  await db.schema.alterTable('personalAiJobs')
    .addColumn('notificationHandledAt', 'timestamptz').execute();
  // Outcomes that predate this feature should not flood the personal inbox.
  // Active jobs remain pending and receive a notification when they finish.
  await db.updateTable('personalAiJobs').set({ notificationHandledAt: new Date() })
    .where('status', 'in', ['completed', 'conflict', 'failed']).execute();
  await db.schema.createIndex('personal_ai_job_pending_notification')
    .on('personalAiJobs').columns(['updatedAt', 'id'])
    .where(sql<boolean>`notification_handled_at is null and status in ('completed','conflict','failed')`).execute();
}

export async function down(db: Kysely<any>) {
  await db.schema.dropIndex('personal_ai_job_pending_notification').execute();
  await db.schema.alterTable('personalAiJobs').dropColumn('notificationHandledAt').execute();
}
