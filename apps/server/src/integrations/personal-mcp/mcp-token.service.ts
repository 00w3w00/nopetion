import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import type { Selectable } from 'kysely';
import type { McpTokenTable } from '@docmost/db/types/personal-mcp.types';
import type { KyselyDB } from '@docmost/db/types/kysely.types';
import type { User, Workspace } from '@docmost/db/types/entity.types';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { PersonalWorkspaceAccess } from '../../core/personal-workspace/personal-workspace-access.service';
import { EnvironmentService } from '../environment/environment.service';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';

export type McpContext = {
  token: Selectable<McpTokenTable>;
  user: User;
  workspace: Workspace;
};
export type McpTokenInput = {
  name: string;
  access: 'read' | 'write';
  spaceIds: string[];
  expiresInDays: number;
};
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const publicFields = [
  'id',
  'name',
  'access',
  'spaceIds',
  'createdAt',
  'expiresAt',
  'lastUsedAt',
  'revokedAt',
] as const;

@Injectable()
export class McpTokenService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly access: PersonalWorkspaceAccess,
    private readonly users: UserRepo,
    private readonly workspaces: WorkspaceRepo,
    private readonly spaces: SpaceRepo,
    private readonly abilities: SpaceAbilityFactory,
    private readonly environment: EnvironmentService,
  ) {}

  database() {
    return this.db;
  }
  endpoint() {
    return this.environment.getAppUrl() + '/mcp';
  }
  assertOrigin(origin?: string) {
    if (
      origin !== undefined &&
      origin !== new URL(this.environment.getAppUrl()).origin &&
      origin !== `http://localhost:${this.environment.getPort()}` &&
      origin !== `http://127.0.0.1:${this.environment.getPort()}`
    )
      throw new ForbiddenException('MCP origin is not allowed');
  }
  async selected(account: User, root: Workspace, target: Workspace) {
    this.access.assertOwner(account);
    return this.access.resolve(account, root, target.id);
  }
  async list(account: User, root: Workspace, target: Workspace) {
    await this.selected(account, root, target);
    const tokens = await this.database()
      .selectFrom('personalMcpTokens')
      .select(publicFields)
      .where('ownerId', '=', account.id)
      .where('workspaceId', '=', target.id)
      .orderBy('createdAt', 'desc')
      .execute();
    return {
      endpoint: this.endpoint(),
      transport: 'streamable-http',
      authentication: 'Bearer',
      tokens,
    };
  }
  async create(
    account: User,
    root: Workspace,
    target: Workspace,
    input: McpTokenInput,
  ) {
    const { user } = await this.selected(account, root, target);
    const ids = [...new Set(input.spaceIds)];
    if (!ids.length || ids.length > 50)
      throw new BadRequestException('Choose between 1 and 50 Spaces');
    for (const id of ids) {
      const space = await this.spaces.findById(id, target.id);
      if (!space || space.deletedAt)
        throw new ForbiddenException('Space unavailable');
      const ability = await this.abilities.createForUser(user, id);
      if (
        ability.cannot(
          input.access === 'write'
            ? SpaceCaslAction.Create
            : SpaceCaslAction.Read,
          SpaceCaslSubject.Page,
        )
      )
        throw new ForbiddenException('Insufficient Space permission');
    }
    const id = randomUUID(),
      secret = `npmcp_${id}_${randomBytes(32).toString('base64url')}`;
    const token = await this.database()
      .insertInto('personalMcpTokens')
      .values({
        id,
        ownerId: account.id,
        workspaceId: target.id,
        name: input.name.trim(),
        tokenHash: hash(secret),
        access: input.access,
        spaceIds: ids,
        expiresAt: new Date(Date.now() + input.expiresInDays * 86400000),
        revokedAt: null,
        lastUsedAt: null,
      })
      .returning(publicFields)
      .executeTakeFirstOrThrow();
    return { ...token, secret };
  }
  async revoke(account: User, root: Workspace, target: Workspace, id: string) {
    await this.selected(account, root, target);
    await this.database()
      .updateTable('personalMcpTokens')
      .set({ revokedAt: new Date() })
      .where('id', '=', id)
      .where('ownerId', '=', account.id)
      .where('workspaceId', '=', target.id)
      .execute();
    return { revoked: true };
  }
  async authenticate(authorization?: string): Promise<McpContext> {
    if (!this.access.enabled())
      throw new UnauthorizedException('MCP authentication required');
    const match =
      /^Bearer (npmcp_([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})_[A-Za-z0-9_-]{43})$/i.exec(
        authorization || '',
      );
    if (!match) throw new UnauthorizedException('MCP authentication required');
    const token = await this.database()
      .selectFrom('personalMcpTokens')
      .selectAll()
      .where('id', '=', match[2])
      .executeTakeFirst();
    if (
      !token ||
      !/^[a-f0-9]{64}$/.test(token.tokenHash) ||
      token.revokedAt ||
      new Date(token.expiresAt).getTime() <= Date.now() ||
      !timingSafeEqual(
        Buffer.from(token.tokenHash, 'hex'),
        Buffer.from(hash(match[1]), 'hex'),
      )
    )
      throw new UnauthorizedException('MCP key is invalid or expired');
    const owner = await this.db
      .selectFrom('users')
      .select(['workspaceId'])
      .where('id', '=', token.ownerId)
      .executeTakeFirst();
    if (!owner) throw new UnauthorizedException('MCP owner unavailable');
    const [account, root] = await Promise.all([
      this.users.findById(token.ownerId, owner.workspaceId),
      this.workspaces.findById(owner.workspaceId),
    ]);
    if (!account || !root || root.deletedAt)
      throw new UnauthorizedException('MCP owner unavailable');
    let selected: Awaited<ReturnType<PersonalWorkspaceAccess['resolve']>>;
    try {
      this.access.assertOwner(account);
      selected = await this.access.resolve(account, root, token.workspaceId);
    } catch {
      throw new UnauthorizedException('MCP workspace unavailable');
    }
    await this.database()
      .updateTable('personalMcpTokens')
      .set({ lastUsedAt: new Date() })
      .where('id', '=', token.id)
      .execute();
    return { token, ...selected };
  }
}
