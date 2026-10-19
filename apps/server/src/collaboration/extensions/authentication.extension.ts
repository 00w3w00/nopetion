import { beforeHandleMessagePayload, connectedPayload, Extension, onAuthenticatePayload, onDisconnectPayload, onTokenSyncPayload } from '@hocuspocus/server';
import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from '../../core/auth/services/token.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { findHighestUserSpaceRole } from '@docmost/db/repos/space/utils';
import { SpaceRole } from '../../common/helpers/types/permission';
import { isUserDisabled } from '../../common/helpers';
import { getPageId } from '../collaboration.util';
import { JwtCollabPayload, JwtType } from '../../core/auth/dto/jwt-payload';
import { PersonalWorkspaceAccess } from '../../core/personal-workspace/personal-workspace-access.service';
import { RealtimeSessionAccess, RealtimeSessionIdentity } from '../../core/session/realtime-session-access';

@Injectable()
export class AuthenticationExtension implements Extension {
  private readonly logger = new Logger(AuthenticationExtension.name);
  private readonly connections = new Set<connectedPayload["connection"]>();

  constructor(
    private tokenService: TokenService,
    private userRepo: UserRepo,
    private pageRepo: PageRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly personalWorkspaces: PersonalWorkspaceAccess,
    private readonly realtimeSessions: RealtimeSessionAccess,
  ) {}

  async beforeHandleMessage({ context }: beforeHandleMessagePayload) {
    await this.realtimeSessions.assertActive(context?.realtimeSession);
    await this.personalWorkspaces.validateCollaborationUser(context.user);
  }

  async connected({ context, connection }: connectedPayload) {
    await this.realtimeSessions.assertActive(context.realtimeSession);
    this.connections.add(connection);
    this.realtimeSessions.track(connection, () => connection.context.realtimeSession,
      () => connection.close({ code: 4401, reason: 'Session expired or revoked' }));
  }

  async onDisconnect({ socketId, documentName }: onDisconnectPayload) {
    for (const connection of this.connections) {
      if (connection.socketId === socketId && connection.document.name === documentName) {
        this.realtimeSessions.untrack(connection);
        this.connections.delete(connection);
      }
    }
  }

  private identity(payload: JwtCollabPayload): RealtimeSessionIdentity {
    return {
      sessionId: payload.sessionId, accountId: payload.accountId,
      accountWorkspaceId: payload.accountWorkspaceId,
      userId: payload.sub, workspaceId: payload.workspaceId,
      expiresAt: payload.exp * 1000,
    };
  }

  async onTokenSync({ token, context }: onTokenSyncPayload) {
    const payload = await this.tokenService.verifyJwt(token, JwtType.COLLAB);
    const identity = this.identity(payload);
    const previous = context.realtimeSession as RealtimeSessionIdentity;
    if (!previous || ['sessionId', 'accountId', 'accountWorkspaceId', 'userId', 'workspaceId']
      .some(key => identity[key] !== previous[key])) throw new UnauthorizedException('Realtime identity cannot change');
    await this.realtimeSessions.assertActive(identity);
    context.realtimeSession = identity;
  }

  async onAuthenticate(data: onAuthenticatePayload) {
    const { documentName, token } = data;
    const pageId = getPageId(documentName);

    let jwtPayload: JwtCollabPayload;

    try {
      jwtPayload = await this.tokenService.verifyJwt(token, JwtType.COLLAB);
    } catch (error) {
      throw new UnauthorizedException('Invalid collab token');
    }

    const userId = jwtPayload.sub;
    const workspaceId = jwtPayload.workspaceId;
    const realtimeSession = this.identity(jwtPayload);
    await this.realtimeSessions.assertActive(realtimeSession);

    const user = await this.userRepo.findById(userId, workspaceId);

    if (!user) {
      throw new UnauthorizedException();
    }

    if (isUserDisabled(user)) {
      throw new UnauthorizedException();
    }
    await this.personalWorkspaces.validateCollaborationUser(user);

    const page = await this.pageRepo.findById(pageId);
    if (!page) {
      this.logger.debug(`Page not found: ${pageId}`);
      throw new NotFoundException('Page not found');
    }

    const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(
      user.id,
      page.spaceId,
    );

    const userSpaceRole = findHighestUserSpaceRole(userSpaceRoles);

    if (!userSpaceRole) {
      this.logger.warn(`User not authorized to access page: ${pageId}`);
      throw new UnauthorizedException();
    }

    // Check page-level permissions
    const { hasAnyRestriction, canAccess, canEdit } =
      await this.pagePermissionRepo.canUserEditPage(user.id, page.id);

    if (hasAnyRestriction) {
      if (!canAccess) {
        this.logger.warn(
          `User ${user.id} denied page-level access to page: ${pageId}`,
        );
        throw new UnauthorizedException();
      }

      if (!canEdit) {
        data.connectionConfig.readOnly = true;
        this.logger.debug(
          `User ${user.id} granted readonly access to restricted page: ${pageId}`,
        );
      }
    } else {
      // No restrictions - use space-level permissions
      if (userSpaceRole === SpaceRole.READER) {
        data.connectionConfig.readOnly = true;
        this.logger.debug(`User granted readonly access to page: ${pageId}`);
      }
    }

    if (page.deletedAt) {
      data.connectionConfig.readOnly = true;
    }

    this.logger.debug(`Authenticated user ${user.id} on page ${pageId}`);

    return {
      user,
      realtimeSession,
    };
  }
}
