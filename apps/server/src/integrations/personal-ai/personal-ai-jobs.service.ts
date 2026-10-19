import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Selectable, sql } from 'kysely';
import * as Y from 'yjs';
import type { KyselyDB } from '@docmost/db/types/kysely.types';
import type { PersonalAiJobTable } from '@docmost/db/types/personal-ai-job.types';
import type { User } from '@docmost/db/types/entity.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import { PersonalWorkspaceAccess } from '../../core/personal-workspace/personal-workspace-access.service';
import { EnvironmentService } from '../environment/environment.service';
import { CollaborationGateway } from '../../collaboration/collaboration.gateway';
import { MCP_OPERATION_MAP, mcpFingerprint, mcpRevision } from '../personal-mcp/mcp-content';
import { PersonalAiService, AiPlan, sourceHash } from './personal-ai.service';
import { StartAiJobDto } from './personal-ai.dto';
import { aiJobBlocks, validateAiSnapshot } from './ai-job-content';
import { QueueName } from '../queue/constants';
import { PersonalAiNotificationsService } from './personal-ai-notifications.service';

type AiJob = Selectable<PersonalAiJobTable>;
type JobPlan = AiPlan & { revision: string; insertionIndex: number };
const active = ['queued', 'generating', 'applying'] as const;
const ownerId = (user: User) => (user as User & { accountId?: string }).accountId || user.id;
const running = (job: AiJob) => active.includes(job.status as typeof active[number]);

@Injectable()
export class PersonalAiJobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval>;
  private recovering = false;
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    @InjectQueue(QueueName.PERSONAL_AI_QUEUE) private readonly queue: Queue,
    private readonly ai: PersonalAiService,
    private readonly pages: PageRepo,
    private readonly permissions: PageAccessService,
    private readonly workspaces: WorkspaceRepo,
    private readonly users: UserRepo,
    private readonly personal: PersonalWorkspaceAccess,
    private readonly environment: EnvironmentService,
    private readonly collaboration: CollaborationGateway,
    private readonly notifications: PersonalAiNotificationsService,
  ) {}

  onApplicationBootstrap() {
    if (!this.environment.isPersonalMode()) return;
    void this.recover();
    this.timer = setInterval(() => void this.recover(), 5000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async recover() {
    if (this.recovering) return;
    this.recovering = true;
    try {
      await this.db.updateTable('personalAiJobs')
        .set({ status: 'failed', errorCode: 'interrupted', updatedAt: new Date() })
        .where('status', '=', 'generating')
        .where('updatedAt', '<', new Date(Date.now() - 10 * 60_000)).execute();
      const jobs = await this.db.selectFrom('personalAiJobs').select(['id'])
        .where('status', 'in', ['queued', 'applying']).orderBy('createdAt').limit(100).execute();
      for (const job of jobs) await this.enqueue(job.id);
    } catch { /* Durable DB rows will be retried when Redis/DB is available. */ }
    finally {
      try { await this.notifications.recover(); } catch { /* The durable outbox remains pending. */ }
      this.recovering = false;
    }
  }
  private enqueue(id: string) {
    return this.queue.add('personal-ai', { id }, { jobId: id, attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: true });
  }
  private async page(user: User, id: string, edit: boolean) {
    if (!this.environment.isPersonalMode()) throw new ForbiddenException({ code: 'personalOnly' });
    const page = await this.pages.findById(id, { includeContent: true, includeYdoc: true });
    if (!page || page.workspaceId !== user.workspaceId || page.deletedAt || page.isBase)
      throw new NotFoundException({ code: 'documentNotFound' });
    if (edit) {
      if (page.isLocked) throw new ForbiddenException({ code: 'documentLocked' });
      await this.permissions.validateCanEdit(page, user);
    } else await this.permissions.validateCanView(page, user);
    return page;
  }
  private own(user: User, job: AiJob) {
    if (!job || job.ownerId !== ownerId(user) || job.workspaceId !== user.workspaceId || job.userId !== user.id)
      throw new NotFoundException({ code: 'documentNotFound' });
  }
  private public(job: AiJob) {
    const plan = job.payload as JobPlan;
    return { id: job.id, pageId: job.pageId, status: job.status, title: plan.title,
      action: plan.action, instruction: plan.instruction, model: plan.model,
      provider: 'ChatGPT OAuth', errorCode: job.errorCode, createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      resultText: ['conflict', 'failed'].includes(job.status) ? job.resultText : undefined };
  }
  async list(user: User, pageId: string, jobId?: string) {
    await this.page(user, pageId, false);
    let query = this.db.selectFrom('personalAiJobs').selectAll()
      .where('ownerId', '=', ownerId(user)).where('userId', '=', user.id)
      .where('workspaceId', '=', user.workspaceId).where('pageId', '=', pageId);
    if (jobId) query = query.where('id', '=', jobId);
    const jobs = await query.orderBy('createdAt', 'desc').limit(jobId ? 1 : 5).execute();
    return { items: jobs.map(job => this.public(job)) };
  }
  async start(user: User, dto: StartAiJobDto) {
    const page = await this.page(user, dto.pageId, true);
    validateAiSnapshot(dto.sourceContent);
    const fingerprint = mcpFingerprint(dto);
    const previous = await this.db.selectFrom('personalAiJobs').selectAll().where('id', '=', dto.operationId).executeTakeFirst();
    if (previous) {
      this.own(user, previous);
      if (previous.fingerprint !== fingerprint) throw new ConflictException({ code: 'requestReused' });
      return this.public(previous);
    }
    if (dto.sourceHash !== sourceHash(dto.sourceContent) ||
        mcpRevision(dto.sourceContent) !== mcpRevision(page.content) || (page.title || '') !== dto.sourceTitle)
      throw new ConflictException({ code: 'sourceChanged' });
    const count = validateAiSnapshot(dto.sourceContent).content?.length || 0;
    if (dto.insertionIndex > count) throw new BadRequestException({ code: 'input' });
    const plan: JobPlan = { ...await this.ai.backgroundPlan(user, { ...dto, sourceHash: sourceHash(page.content) }),
      revision: mcpRevision(page.content), insertionIndex: dto.insertionIndex };
    const row = await this.db.transaction().execute(async trx => {
      await sql`select pg_advisory_xact_lock(hashtextextended(${'personal-ai:' + ownerId(user)}, 0))`.execute(trx);
      const existing = await trx.selectFrom('personalAiJobs').selectAll().where('id', '=', dto.operationId).executeTakeFirst();
      if (existing) {
        this.own(user, existing);
        if (existing.fingerprint !== fingerprint) throw new ConflictException({ code: 'requestReused' });
        return existing;
      }
      const pending = await trx.selectFrom('personalAiJobs').select(['pageId'])
        .where('ownerId', '=', ownerId(user)).where('status', 'in', [...active]).execute();
      if (pending.length >= 2 || pending.some(job => job.pageId === page.id))
        throw new ConflictException({ code: 'busy' });
      return trx.insertInto('personalAiJobs').values({ id: dto.operationId, ownerId: ownerId(user),
        userId: user.id, workspaceId: user.workspaceId, pageId: page.id, fingerprint,
        status: 'queued', payload: plan, resultText: null, resultBlocks: null, errorCode: null })
        .returningAll().executeTakeFirstOrThrow();
    });
    // Returning to the browser never waits for inference. A lost Redis enqueue is
    // repaired from the durable row; browser disconnect does not cancel this work.
    void this.enqueue(row.id).catch(() => undefined);
    return this.public(row);
  }
  private async actor(job: AiJob) {
    const info = await this.db.selectFrom('users').select('workspaceId').where('id', '=', job.ownerId).executeTakeFirst();
    if (!info) throw new ForbiddenException();
    const [account, root] = await Promise.all([this.users.findById(job.ownerId, info.workspaceId), this.workspaces.findById(info.workspaceId)]);
    if (!account || !root || root.deletedAt) throw new ForbiddenException();
    this.personal.assertOwner(account);
    const selected = await this.personal.resolve(account, root, job.workspaceId);
    if (selected.user.id !== job.userId) throw new ForbiddenException();
    return selected.user;
  }
  private receipt(job: AiJob, ydoc: Uint8Array) {
    const doc = new Y.Doc();
    try {
      if (ydoc) Y.applyUpdate(doc, new Uint8Array(ydoc));
      const receipt = doc.getMap<any>(MCP_OPERATION_MAP).get('ai:' + job.id);
      return receipt?.fingerprint === this.writeFingerprint(job);
    } finally { doc.destroy(); }
  }
  private writeFingerprint(job: AiJob) { return mcpFingerprint({ id: job.id, blocks: job.resultBlocks, plan: job.payload }); }
  private async apply(job: AiJob, user: User) {
    const plan = job.payload as JobPlan;
    return this.db.transaction().execute(async trx => {
      await sql`select pg_advisory_xact_lock(hashtextextended(${'page-title:' + job.pageId}, 0))`.execute(trx);
      const page = await this.page(user, job.pageId, true);
      if (!this.receipt(job, page.ydoc)) {
        if (job.writeAttempts >= 8) throw new ConflictException({ code: 'cannotWrite' });
        const status = this.ai.status(user);
        if (!status.connected || status.activeId !== plan.profileId || status.model !== plan.model)
          throw new ConflictException({ code: 'accountChanged' });
        if ((page.title || '') !== plan.title || sourceHash(page.content) !== plan.sourceHash)
          throw new ConflictException({ code: 'sourceChanged' });
        const result = await this.collaboration.handleYjsEvent('mcpMutateDocument', `page.${page.id}`, {
          user, operation: 'insert', expectedRevision: plan.revision, blockIndex: plan.insertionIndex,
          prosemirrorJson: job.resultBlocks, receiptKey: 'ai:' + job.id, fingerprint: this.writeFingerprint(job),
        });
        if (result?.error) {
          if (/Stale revision/.test(result.error)) throw new ConflictException({ code: 'sourceChanged' });
          if (/Block index|blocks unavailable|operationId/.test(result.error)) throw new ConflictException({ code: 'cannotWrite' });
          throw new Error('Collaboration write unavailable');
        }
        const committed = await this.pages.findById(page.id, { includeYdoc: true });
        if (!result || !committed || !this.receipt(job, committed.ydoc))
          throw new Error('Commit not confirmed');
      }
      await trx.updateTable('personalAiJobs').set({ status: 'completed', updatedAt: new Date(), errorCode: null })
        .where('id', '=', job.id).where('status', '=', 'applying').execute();
    });
  }
  private errorCode(error: unknown) {
    if (!(error instanceof HttpException)) return 'backgroundFailed';
    const body = error.getResponse() as { code?: string };
    return body?.code && /^[a-zA-Z]{1,40}$/.test(body.code) ? body.code : 'documentNotFound';
  }
  async process(id: string) {
    try {
      await this.processJob(id);
    } finally {
      await this.notifications.notifySafely(id);
    }
  }
  private async processJob(id: string) {
    let job = await this.db.selectFrom('personalAiJobs').selectAll().where('id', '=', id).executeTakeFirst();
    if (!job || !running(job)) return;
    // Never repeat an interrupted upstream inference automatically. Applying a
    // stored result is independently idempotent and safe to resume.
    if (job.status === 'generating') {
      await this.db.updateTable('personalAiJobs').set({ status: 'failed', errorCode: 'interrupted', updatedAt: new Date() })
        .where('id', '=', id).where('status', '=', 'generating')
        .where('updatedAt', '<', new Date(Date.now() - 10 * 60_000)).execute();
      return;
    }
    try {
      const user = await this.actor(job);
      await this.page(user, job.pageId, true);
      if (job.status === 'queued') {
        const claimed = await this.db.updateTable('personalAiJobs').set({ status: 'generating', updatedAt: new Date() })
          .where('id', '=', id).where('status', '=', 'queued').returningAll().executeTakeFirst();
        if (!claimed) return;
        const { text } = await this.ai.generatePlan(user, claimed.payload as JobPlan);
        const blocks = aiJobBlocks(text);
        job = await this.db.updateTable('personalAiJobs').set({ status: 'applying', resultText: text,
          resultBlocks: blocks, updatedAt: new Date() }).where('id', '=', id)
          .where('status', '=', 'generating').returningAll().executeTakeFirst();
        if (!job) return; // A reset/deletion removed the document and its job.
      }
      const freshUser = await this.actor(job);
      await this.db.updateTable('personalAiJobs').set({ writeAttempts: sql`write_attempts + 1`, updatedAt: new Date() }).where('id', '=', id).execute();
      await this.apply(job, freshUser);
    } catch (error) {
      // Transient infrastructure failures in the write phase can retry the same
      // persisted output/receipt; upstream generation is never repeated here.
      if (!(error instanceof HttpException) && job.status === 'applying') throw error;
      await this.db.updateTable('personalAiJobs').set({ status: error instanceof ConflictException && job.resultText ? 'conflict' : 'failed',
        errorCode: this.errorCode(error), updatedAt: new Date() }).where('id', '=', id)
        .where('status', 'in', [...active]).execute();
    }
  }
}
