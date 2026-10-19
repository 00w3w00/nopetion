import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import {
  JwtApiKeyPayload,
  JwtOAuthPayload,
  JwtPayload,
  JwtType,
} from '../dto/jwt-payload';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { UserSessionRepo } from '@docmost/db/repos/session/user-session.repo';
import { SessionActivityService } from '../../session/session-activity.service';
import { FastifyRequest } from 'fastify';
import { extractBearerTokenFromHeader, isUserDisabled } from '../../../common/helpers';
import { ModuleRef } from '@nestjs/core';
import { PersonalWorkspaceAccess } from '../../personal-workspace/personal-workspace-access.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private logger = new Logger('JwtStrategy');

  constructor(
    private userRepo: UserRepo,
    private workspaceRepo: WorkspaceRepo,
    private userSessionRepo: UserSessionRepo,
    private sessionActivityService: SessionActivityService,
    private readonly environmentService: EnvironmentService,
    private moduleRef: ModuleRef,
    private personalWorkspaces: PersonalWorkspaceAccess,
  ) {
    super({
      jwtFromRequest: (req: FastifyRequest) => {
        return req.cookies?.authToken || extractBearerTokenFromHeader(req);
      },
      ignoreExpiration: false,
      secretOrKey: environmentService.getAppSecret(),
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    payload: JwtPayload | JwtApiKeyPayload | JwtOAuthPayload,
  ): Promise<any> {
    if (!payload.workspaceId) {
      throw new UnauthorizedException();
    }

    if (req.raw.workspaceId && req.raw.workspaceId !== payload.workspaceId) {
      throw new UnauthorizedException('Workspace does not match');
    }

    if (payload.type === JwtType.API_KEY) return this.validateApiKey(req, payload as JwtApiKeyPayload);
    if (payload.type === JwtType.OAUTH_ACCESS) return this.validateOAuthToken(req, payload as JwtOAuthPayload);

    if (payload.type !== JwtType.ACCESS) {
      throw new UnauthorizedException();
    }

    const workspace = await this.workspaceRepo.findById(payload.workspaceId);

    if (!workspace || workspace.deletedAt) {
      throw new UnauthorizedException();
    }
    const user = await this.userRepo.findById(payload.sub, payload.workspaceId);

    if (!user || isUserDisabled(user)) {
      throw new UnauthorizedException();
    }

    if (!(payload as JwtPayload).sessionId) throw new UnauthorizedException('Please sign in again');
    if ((payload as JwtPayload).sessionId) {
      const sessionId = (payload as JwtPayload).sessionId;
      const session = await this.userSessionRepo.findActiveById(sessionId);
      if (!session || session.userId !== payload.sub || session.workspaceId !== payload.workspaceId) {
        throw new UnauthorizedException();
      }
      req.raw.sessionId = sessionId;
      this.sessionActivityService.trackActivity(sessionId, payload.sub, payload.workspaceId);
    }

    if (this.personalWorkspaces.enabled()) {
      const selected = await this.personalWorkspaces.resolve(user, workspace,
        await this.personalWorkspaces.requestTarget(req));
      req.raw.workspaceId = selected.workspace.id;
      req.raw.workspace = selected.workspace;
      return { ...selected, accountUser: user, accountWorkspace: workspace, authType: JwtType.ACCESS };
    }
    return { user, workspace, authType: JwtType.ACCESS };
  }

  private async validateApiKey(req: any, payload: JwtApiKeyPayload): Promise<never> {
    throw new UnauthorizedException("API key authentication is unavailable in this build");
  }

  private async validateOAuthToken(req: any, payload: JwtOAuthPayload): Promise<never> {
    throw new UnauthorizedException("Programmatic OAuth authentication is unavailable in this build");
  }
}
