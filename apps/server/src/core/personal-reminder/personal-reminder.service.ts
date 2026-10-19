import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { User } from '@docmost/db/types/entity.types';
import { PageAccessService } from '../page/page-access/page-access.service';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { WsGateway } from '../../ws/ws.gateway';

export function hasReminderBlock(content: unknown, blockId: string): boolean {
  if (typeof content === 'string') { try { content = JSON.parse(content); } catch { return false; } }
  if (!content || typeof content !== 'object') return false;
  const node = content as { type?: string; attrs?: { id?: string }; content?: unknown[] };
  return (node.type === 'personalDate' && node.attrs?.id === blockId) ||
    (Array.isArray(node.content) && node.content.some(child => hasReminderBlock(child, blockId)));
}
@Injectable()
export class PersonalReminderService implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval>;
  private running = false;
  private logger = new Logger(PersonalReminderService.name);
  constructor(@InjectKysely() private db: KyselyDB, private pages: PageRepo,
    private access: PageAccessService, private users: UserRepo, private ws: WsGateway) {}
  onApplicationBootstrap() {
    this.timer = setInterval(() => this.deliverDue().catch(() => this.logger.error('Reminder delivery failed; it will be retried')), 10000);
    this.timer.unref();
  }
  onModuleDestroy() { clearInterval(this.timer); }
  private async page(pageId: string, user: User) {
    const page = await this.pages.findById(pageId, { includeContent: true });
    if (!page || page.workspaceId !== user.workspaceId || page.deletedAt) throw new NotFoundException();
    await this.access.validateCanEdit(page, user);
    return page;
  }
  async list(pageId: string, user: User) {
    await this.page(pageId, user);
    return this.db.selectFrom('personalReminders').select(['id','blockId','dueAt','deliveredAt'])
      .where('userId','=',user.id).where('pageId','=',pageId).where('cancelledAt','is',null).execute();
  }
  async set(pageId: string, blockId: string, dueAt: string | undefined, user: User) {
    await this.page(pageId, user);
    if (!dueAt) {
      await this.db.updateTable('personalReminders').set({ cancelledAt: new Date() })
        .where('userId','=',user.id).where('pageId','=',pageId).where('blockId','=',blockId).execute();
      return { cancelled: true };
    }
    const due = new Date(dueAt);
    if (!Number.isFinite(due.getTime()) || due.getTime() < Date.now() - 60000 || due.getTime() > Date.now() + 366 * 86400000)
      throw new BadRequestException('Choose a reminder within the next year');
    return this.db.insertInto('personalReminders').values({ userId:user.id, workspaceId:user.workspaceId, pageId, blockId, dueAt:due })
      .onConflict(oc => oc.columns(['userId','pageId','blockId']).doUpdateSet({ dueAt:due, deliveredAt:null, cancelledAt:null }))
      .returning(['id','blockId','dueAt']).executeTakeFirstOrThrow();
  }
  async deliverDue() {
    if (this.running) return;
    this.running = true;
    try {
      const delivered = await this.db.transaction().execute(async tx => {
        const due = await tx.selectFrom('personalReminders').selectAll()
          .where('dueAt','<=',new Date()).where('deliveredAt','is',null).where('cancelledAt','is',null)
          .orderBy('dueAt').limit(100).forUpdate().skipLocked().execute();
        const results: {id:string;userId:string}[] = [];
        for (const row of due) {
          const user = await this.users.findById(row.userId, row.workspaceId);
          const workspace = await tx.selectFrom('workspaces').select(['deletedAt']).where('id','=',row.workspaceId).executeTakeFirst();
          const page = await this.pages.findById(row.pageId, { includeContent:true });
          let allowed = !!user && !user.deletedAt && !user.deactivatedAt && !!workspace && !workspace.deletedAt && !!page && page.workspaceId === row.workspaceId && !page.deletedAt && hasReminderBlock(page.content, row.blockId);
          if (allowed) { try { await this.access.validateCanView(page, user); } catch { allowed = false; } }
          if (!allowed) { await tx.updateTable('personalReminders').set({cancelledAt:new Date()}).where('id','=',row.id).execute(); continue; }
          const notification = await tx.insertInto('notifications').values({ userId:row.userId, workspaceId:row.workspaceId,
            pageId:row.pageId, spaceId:page.spaceId, type:'page.reminder', data:{blockId:row.blockId,dueAt:new Date(row.dueAt).toISOString()} })
            .returning('id').executeTakeFirstOrThrow();
          await tx.updateTable('personalReminders').set({deliveredAt:new Date()}).where('id','=',row.id).execute();
          results.push({id:notification.id,userId:row.userId});
        }
        return results;
      });
      for (const row of delivered) this.ws.server?.to(`user-${row.userId}`).emit('notification',{id:row.id,type:'page.reminder'});
    } finally { this.running = false; }
  }
}
