import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { KyselyDB } from '@docmost/db/types/kysely.types';
import type { User } from '@docmost/db/types/entity.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageAccessService } from '../page/page-access/page-access.service';
import { PersonalWorkspaceAccess } from '../personal-workspace/personal-workspace-access.service';
import { EventName } from '../../common/events/event.contants';
import type { SyncTitleDto } from './personal-sync.module';

@Injectable()
export class PersonalSyncService {
  constructor(@InjectKysely() private readonly db: KyselyDB,
    private readonly pages: PageRepo,
    private readonly permissions: PageAccessService,
    private readonly personal: PersonalWorkspaceAccess,
    private readonly events: EventEmitter2) {}

  async access(pageId: string, user: User) {
    this.personal.assertOwner(user);
    await this.personal.validateCollaborationUser(user);
    const page = await this.pages.findById(pageId, { includeContent: true, includeSpace: true });
    if (!page || page.workspaceId !== user.workspaceId || page.deletedAt) throw new NotFoundException();
    const permissions = await this.permissions.validateCanViewWithPermissions(page, user, true);
    if (page.isLocked || !permissions.canEdit) throw new ForbiddenException('Page is unavailable for offline editing');
    return { ...page, permissions };
  }

  async title(dto: SyncTitleDto, user: User) {
    this.personal.assertOwner(user);
    await this.personal.validateCollaborationUser(user);
    const page = await this.pages.findById(dto.pageId);
    if (!page || page.workspaceId !== user.workspaceId || page.deletedAt) throw new NotFoundException();
    if (page.isLocked) throw new ForbiddenException('Page is locked');
    await this.permissions.validateCanEdit(page, user, true);
    const outcome = await this.db.transaction().execute(async trx => {
      // Use the same lock as ordinary title writes and background AI insertion.
      await sql`select pg_advisory_xact_lock(hashtextextended(${'page-title:' + page.id}, 0))`.execute(trx);
      const current = await trx.selectFrom('pages').select(['id', 'title', 'updatedAt', 'isLocked', 'workspaceId', 'spaceId'])
        .where('id', '=', page.id).where('workspaceId', '=', user.workspaceId)
        .where('deletedAt', 'is', null).executeTakeFirst();
      if (!current) throw new NotFoundException();
      if (current.isLocked) throw new ForbiddenException('Page is locked');
      await this.personal.validateCollaborationUser(user);
      await this.permissions.validateCanEdit({ ...page, ...current }, user, true);
      if ((current.title || '') === dto.title) return { ...current, replay: true };
      const saved = await trx.updateTable('pages')
        .set({ title: dto.title, updatedAt: new Date(), lastUpdatedById: user.id })
        .where('id', '=', page.id).where('workspaceId', '=', user.workspaceId)
        .where('deletedAt', 'is', null).where('isLocked', '=', false)
        .where(sql<boolean>`coalesce(title, '') = ${dto.expectedTitle}`)
        .where(sql<boolean>`date_trunc('milliseconds', updated_at) = ${new Date(dto.expectedUpdatedAt)}`)
        .returning(['id', 'title', 'updatedAt']).executeTakeFirst();
      if (!saved) throw new ConflictException({ code: 'titleConflict', title: current.title || '', updatedAt: current.updatedAt });
      return { ...saved, replay: false };
    });
    if (!outcome.replay) this.events.emit(EventName.PAGE_UPDATED, { pageIds: [page.id], workspaceId: user.workspaceId });
    return { pageId: page.id, title: outcome.title || '', updatedAt: outcome.updatedAt, saved: true, replay: outcome.replay };
  }
}
