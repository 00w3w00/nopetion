import { Injectable, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { UserSessionRepo } from '@docmost/db/repos/session/user-session.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { PersonalWorkspaceAccess } from '../personal-workspace/personal-workspace-access.service';
import { isUserDisabled } from '../../common/helpers';

export interface RealtimeSessionIdentity {
  sessionId: string;
  accountId: string;
  accountWorkspaceId: string;
  userId: string;
  workspaceId: string;
  expiresAt: number;
}

/** Bind a workspace-scoped realtime identity to the canonical login session. */
@Injectable()
export class RealtimeSessionAccess implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private checking = false;
  private readonly connections = new Map<object, {
    identity: () => RealtimeSessionIdentity;
    disconnect: () => void;
  }>();

  constructor(
    private readonly sessions: UserSessionRepo,
    private readonly users: UserRepo,
    private readonly workspaces: WorkspaceRepo,
    private readonly personalWorkspaces: PersonalWorkspaceAccess,
  ) {}

  onModuleInit() {
    // The database check also reaches standalone/cross-process collaboration
    // servers; it does not depend on an in-process logout event.
    this.timer = setInterval(() => void this.checkConnections(), 1000);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
    this.connections.clear();
  }

  track(key: object, identity: () => RealtimeSessionIdentity, disconnect: () => void) {
    this.connections.set(key, { identity, disconnect });
  }

  untrack(key: object) { this.connections.delete(key); }

  async checkConnections() {
    if (this.checking) return;
    this.checking = true;
    try {
      await Promise.all([...this.connections].map(async ([key, entry]) => {
        try { await this.assertActive(entry.identity()); }
        catch {
          this.connections.delete(key);
          try { entry.disconnect(); } catch { /* Transport may already be closed. */ }
        }
      }));
    } finally { this.checking = false; }
  }

  async assertActive(identity: RealtimeSessionIdentity) {
    if (!identity || !identity.sessionId || !identity.accountId || !identity.accountWorkspaceId
      || !identity.userId || !identity.workspaceId || !Number.isFinite(identity.expiresAt)
      || identity.expiresAt <= Date.now()) throw new UnauthorizedException('Realtime session expired');

    const [session, account, workspace] = await Promise.all([
      this.sessions.findActiveById(identity.sessionId),
      this.users.findById(identity.accountId, identity.accountWorkspaceId),
      this.workspaces.findById(identity.accountWorkspaceId),
    ]);
    if (!session || session.userId !== identity.accountId || session.workspaceId !== identity.accountWorkspaceId
      || !account || isUserDisabled(account) || !workspace || workspace.deletedAt)
      throw new UnauthorizedException('Realtime session revoked');

    if (!this.personalWorkspaces.enabled()) {
      if (identity.userId !== account.id || identity.workspaceId !== workspace.id)
        throw new UnauthorizedException('Realtime session identity mismatch');
      return account;
    }

    const selected = await this.personalWorkspaces.resolve(account, workspace, identity.workspaceId);
    if (selected.user.id !== identity.userId || selected.workspace.id !== identity.workspaceId)
      throw new UnauthorizedException('Realtime session identity mismatch');
    return selected.user;
  }
}
