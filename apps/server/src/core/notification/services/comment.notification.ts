import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  ICommentNotificationJob,
  ICommentResolvedNotificationJob,
} from '../../../integrations/queue/constants/queue.interface';
import { NotificationService } from '../notification.service';
import { NotificationType } from '../notification.constants';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { WatcherRepo } from '@docmost/db/repos/watcher/watcher.repo';
import { getPageTitle } from '../../../common/helpers';

@Injectable()
export class CommentNotificationService {
  private readonly logger = new Logger(CommentNotificationService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly notificationService: NotificationService,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly watcherRepo: WatcherRepo,
  ) {}

  async processComment(data: ICommentNotificationJob, appUrl: string) {
    const {
      commentId,
      parentCommentId,
      pageId,
      spaceId,
      workspaceId,
      actorId,
      mentionedUserIds,
      notifyWatchers,
    } = data;

    const context = await this.getCommentContext(
      actorId,
      pageId,
      spaceId,
      commentId,
      appUrl,
    );
    if (!context) return;

    const { actor, pageTitle, commentUrl } = context;
    const notifiedUserIds = new Set<string>();
    notifiedUserIds.add(actorId);

    const recipientIds = parentCommentId
      ? await this.getThreadParticipantIds(parentCommentId)
      : notifyWatchers
        ? await this.watcherRepo.getPageWatcherIds(pageId)
        : [];

    const allCandidateIds = [
      ...new Set([...mentionedUserIds, ...recipientIds]),
    ];
    const usersWithSpaceAccess =
      await this.spaceMemberRepo.getUserIdsWithSpaceAccess(
        allCandidateIds,
        spaceId,
      );

    const usersWithPageAccess =
      await this.pagePermissionRepo.getUserIdsWithPageAccess(pageId, [
        ...usersWithSpaceAccess,
      ]);
    const usersWithAccess = new Set(usersWithPageAccess);

    for (const userId of mentionedUserIds) {
      if (!usersWithAccess.has(userId)) continue;

      const notification = await this.notificationService.create({
        userId,
        workspaceId,
        type: NotificationType.COMMENT_USER_MENTION,
        actorId,
        pageId,
        spaceId,
        commentId,
      });
      if (!notification) continue;

      notifiedUserIds.add(userId);
    }

    for (const recipientId of recipientIds) {
      if (notifiedUserIds.has(recipientId)) continue;
      if (!usersWithAccess.has(recipientId)) continue;

      const notification = await this.notificationService.create({
        userId: recipientId,
        workspaceId,
        type: NotificationType.COMMENT_CREATED,
        actorId,
        pageId,
        spaceId,
        commentId,
      });
      if (!notification) continue;
    }
  }

  async processResolved(data: ICommentResolvedNotificationJob, appUrl: string) {
    const {
      commentId,
      commentCreatorId,
      pageId,
      spaceId,
      workspaceId,
      actorId,
    } = data;

    if (commentCreatorId === actorId) return;

    const context = await this.getCommentContext(
      actorId,
      pageId,
      spaceId,
      commentId,
      appUrl,
    );
    if (!context) return;

    const { actor, pageTitle, commentUrl } = context;

    const roles = await this.spaceMemberRepo.getUserSpaceRoles(
      commentCreatorId,
      spaceId,
    );

    if (!roles) {
      this.logger.debug(
        `Skipping resolved notification for user ${commentCreatorId}: no access to space ${spaceId}`,
      );
      return;
    }

    const hasPageAccess =
      await this.pagePermissionRepo.getUserIdsWithPageAccess(pageId, [
        commentCreatorId,
      ]);
    if (hasPageAccess.length === 0) return;

    const notification = await this.notificationService.create({
      userId: commentCreatorId,
      workspaceId,
      type: NotificationType.COMMENT_RESOLVED,
      actorId,
      pageId,
      spaceId,
      commentId,
    });
    if (!notification) return;

    const subject = `${actor.name} resolved a comment on ${pageTitle}`;
  }

  private async getThreadParticipantIds(
    parentCommentId: string,
  ): Promise<string[]> {
    const participants = await this.db
      .selectFrom('comments')
      .select('creatorId')
      .where((eb) =>
        eb.or([
          eb('id', '=', parentCommentId),
          eb('parentCommentId', '=', parentCommentId),
        ]),
      )
      .execute();

    return [...new Set(participants.map((p) => p.creatorId))];
  }

  private async getCommentContext(
    actorId: string,
    pageId: string,
    spaceId: string,
    commentId: string,
    appUrl: string,
  ) {
    const [actor, page, space] = await Promise.all([
      this.db
        .selectFrom('users')
        .select(['id', 'name'])
        .where('id', '=', actorId)
        .executeTakeFirst(),
      this.db
        .selectFrom('pages')
        .select(['id', 'title', 'slugId'])
        .where('id', '=', pageId)
        .executeTakeFirst(),
      this.db
        .selectFrom('spaces')
        .select(['id', 'slug'])
        .where('id', '=', spaceId)
        .executeTakeFirst(),
    ]);

    if (!actor || !page || !space) {
      return null;
    }

    const pageUrl = `${appUrl}/s/${space.slug}/p/${page.slugId}`;
    const commentUrl = `${pageUrl}?commentId=${commentId}`;

    return { actor, pageTitle: getPageTitle(page.title), commentUrl };
  }
}
