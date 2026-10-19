import { RealtimeSessionAccess, RealtimeSessionIdentity } from '../core/session/realtime-session-access';
import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../core/auth/services/token.service';
import { JwtPayload, JwtType } from '../core/auth/dto/jwt-payload';
import { OnModuleDestroy } from '@nestjs/common';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { WsService } from './ws.service';
import { getSpaceRoomName, getUserRoomName } from './ws.utils';
import { BaseRealtimeBridge } from './base-realtime.bridge';
import * as cookie from 'cookie';
import { PersonalWorkspaceAccess, PERSONAL_WORKSPACE_COOKIE } from '../core/personal-workspace/personal-workspace-access.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { UserSessionRepo } from '@docmost/db/repos/session/user-session.repo';
import { isUserDisabled } from '../common/helpers';
import { OnEvent } from '@nestjs/event-emitter';

@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket'],
})
export class WsGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;
  private readonly authentication = new WeakMap<Socket, Promise<void>>();

  constructor(
    private tokenService: TokenService,
    private spaceMemberRepo: SpaceMemberRepo,
    private wsService: WsService,
    private baseRealtime: BaseRealtimeBridge,
    private personalWorkspaces: PersonalWorkspaceAccess,
    private users: UserRepo,
    private workspaces: WorkspaceRepo,
    private sessions: UserSessionRepo,
    private realtimeSessions: RealtimeSessionAccess,
  ) {}

  afterInit(server: Server): void {
    this.wsService.setServer(server);
    this.baseRealtime.setServer(server);
  }

  async handleConnection(client: Socket, ...args: any[]): Promise<void> {
    const ready = this.authenticateClient(client);
    this.authentication.set(client, ready);
    await ready;
  }

  private async authenticateClient(client: Socket): Promise<void> {
    try {
      const cookies = cookie.parse(client.handshake.headers.cookie);
      const token: JwtPayload = await this.tokenService.verifyJwt(
        cookies['authToken'],
        JwtType.ACCESS,
      );

      const identity: RealtimeSessionIdentity = {
        sessionId: token.sessionId, accountId: token.sub, accountWorkspaceId: token.workspaceId,
        userId: token.sub, workspaceId: token.workspaceId,
        expiresAt: (token as JwtPayload & { exp: number }).exp * 1000,
      };
      await this.realtimeSessions.assertActive(identity);
      let userId = token.sub;
      let workspaceId = token.workspaceId;
      if (this.personalWorkspaces.enabled()) {
        const [account, workspace] = await Promise.all([
          this.users.findById(token.sub, token.workspaceId), this.workspaces.findById(token.workspaceId),
        ]);
        if (!account || isUserDisabled(account) || !workspace || workspace.deletedAt) throw new Error('Invalid account');
        if (token.sessionId) {
          const session = await this.sessions.findActiveById(token.sessionId);
          if (!session || session.userId !== account.id || session.workspaceId !== workspace.id) throw new Error('Invalid session');
        }
        const selected = await this.personalWorkspaces.resolve(account, workspace,
          client.handshake.auth?.workspaceId ?? cookies[PERSONAL_WORKSPACE_COOKIE]);
        userId = selected.user.id;
        workspaceId = selected.workspace.id;
      }

      identity.userId = userId; identity.workspaceId = workspaceId;
      await this.realtimeSessions.assertActive(identity);
      if (!client.connected) return;
      client.data.realtimeSession = identity;
      this.realtimeSessions.track(client, () => client.data.realtimeSession,
        () => { client.emit('Unauthorized'); client.disconnect(true); });
      client.data.userId = userId;
      client.data.workspaceId = workspaceId;

      const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);

      const userRoom = getUserRoomName(userId);
      const workspaceRoom = `workspace-${workspaceId}`;
      const spaceRooms = userSpaceIds.map((id) => getSpaceRoomName(id));

      client.join([userRoom, workspaceRoom, ...spaceRooms]);
    } catch (err) {
      client.emit('Unauthorized');
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    this.authentication.delete(client);
    this.realtimeSessions.untrack(client);
    await this.baseRealtime.handleDisconnect(client);
  }

  @OnEvent('personal-workspace.deleted')
  handleWorkspaceDeleted({ workspaceId }: { workspaceId: string }) {
    this.server?.in(`workspace-${workspaceId}`).disconnectSockets(true);
  }

  @SubscribeMessage('message')
  async handleMessage(client: Socket, data: any): Promise<void> {
    await this.authentication.get(client);
    try { await this.realtimeSessions.assertActive(client.data.realtimeSession); }
    catch { client.emit('Unauthorized'); client.disconnect(true); return; }
    if (this.personalWorkspaces.enabled()) {
      const workspace = await this.workspaces.findById(client.data.workspaceId);
      if (!workspace || workspace.deletedAt) { client.disconnect(); return; }
    }
    if (this.wsService.isTreeEvent(data)) {
      await this.wsService.handleTreeEvent(client, data);
      return;
    }
    if (this.baseRealtime.isBaseEvent(data)) {
      await this.baseRealtime.handleInbound(client, data);
      return;
    }
  }

  /*
  @SubscribeMessage('join-room')
  handleJoinRoom(client: Socket, @MessageBody() roomName: string): void {
    // if room is a space, check if user has permissions
    //client.join(roomName);
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(client: Socket, @MessageBody() roomName: string): void {
    client.leave(roomName);
  }
 */

  onModuleDestroy() {
    if (this.server) {
      this.server.close();
    }
  }
}
