import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import type { KyselyDB } from '@docmost/db/types/kysely.types';
import type { User } from '@docmost/db/types/entity.types';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageAccessService } from '../page/page-access/page-access.service';
import { PersonalWorkspaceAccess } from '../personal-workspace/personal-workspace-access.service';
import { DEFAULT_CLASSIFICATION_RULES, labelExpression, normalizeRules, ruleExpression } from './classification.rules';
import type { ClassificationConfigDto, ClassificationPagesDto } from './personal-classification.module';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { classificationCursor, readClassificationCursor } from './classification-cursor';

@Injectable()
export class PersonalClassificationService {
  constructor(@InjectKysely() private readonly db: KyselyDB,
    private readonly personal: PersonalWorkspaceAccess,
    private readonly members: SpaceMemberRepo,
    private readonly permissions: PagePermissionRepo,
    private readonly pages: PageRepo,
    private readonly access: PageAccessService,
    private readonly environment: EnvironmentService) {}

  private async allowed(user: User) {
    this.personal.assertOwner(user);
    await this.personal.validateCollaborationUser(user);
  }
  async config(user: User) {
    await this.allowed(user);
    const row = await this.db.selectFrom('personalClassificationConfigs').selectAll()
      .where('workspaceId', '=', user.workspaceId).where('userId', '=', user.id).executeTakeFirst();
    return row ? { enabled: row.enabled, rules: normalizeRules(row.rules), revision: row.revision, updatedAt: row.updatedAt }
      : { enabled: false, rules: normalizeRules(DEFAULT_CLASSIFICATION_RULES), revision: null, updatedAt: null };
  }
  async configure(dto: ClassificationConfigDto, user: User) {
    await this.allowed(user);
    const rules = normalizeRules(dto.rules);
    await this.db.transaction().execute(async trx => {
      await sql`select pg_advisory_xact_lock(hashtextextended(${'classification:' + user.workspaceId}, 0))`.execute(trx);
      const existing = await trx.selectFrom('personalClassificationConfigs').select(['revision', 'userId'])
        .where('workspaceId', '=', user.workspaceId).executeTakeFirst();
      if (existing && (existing.userId !== user.id || existing.revision !== dto.expectedRevision) || !existing && dto.expectedRevision)
        throw new ConflictException('Classification settings changed; reload before saving');
      await trx.insertInto('personalClassificationConfigs').values({ workspaceId: user.workspaceId,
        userId: user.id, ownerId: (user as User & { accountId?: string }).accountId || user.id,
        // Force a text parameter before the JSONB cast: postgres.js otherwise
        // serializes the already-stringified value as a JSON string.
        enabled: dto.enabled, rules: sql<string>`${JSON.stringify(rules)}::text::jsonb`, revision: randomUUID(), updatedAt: new Date() })
        .onConflict(oc => oc.column('workspaceId').doUpdateSet({ enabled: dto.enabled, rules: sql<string>`${JSON.stringify(rules)}::text::jsonb`, revision: randomUUID(), updatedAt: new Date() })).execute();
    });
    return this.config(user);
  }
  private base(user: User) {
    return this.db.selectFrom('pages').innerJoin('spaces', 'spaces.id', 'pages.spaceId')
      .where('pages.workspaceId', '=', user.workspaceId).where('spaces.workspaceId', '=', user.workspaceId)
      .where('pages.deletedAt', 'is', null).where('spaces.deletedAt', 'is', null)
      .where('pages.spaceId', 'in', this.members.getUserSpaceIdsQuery(user.id));
  }
  async list(dto: ClassificationPagesDto, user: User) {
    const config = await this.config(user);
    if (!config.enabled) return { enabled: false, items: [], nextCursor: null };
    const rules = config.rules.filter(rule => rule.enabled);
    let query = this.base(user).select(['pages.id', 'pages.slugId', 'pages.title', 'pages.icon', 'pages.spaceId', 'pages.updatedAt', 'spaces.slug as spaceSlug'])
      .select(labelExpression(rules).as('autoLabels'));
    if (dto.ruleId === 'unclassified') {
      if (rules.length) query = query.where(sql<boolean>`not (${sql.join(rules.map(ruleExpression), sql` or `)})`);
    } else if (dto.ruleId) {
      const rule = rules.find(r => r.id === dto.ruleId);
      if (!rule) throw new BadRequestException('Classification unavailable');
      query = query.where(ruleExpression(rule));
    }
    if (dto.spaceId) query = query.where('pages.spaceId', '=', dto.spaceId);
    if (dto.cursor) query = query.where('pages.id', '<', readClassificationCursor(this.environment.getAppSecret(), user.id, user.workspaceId, dto.cursor));
    if (dto.query?.trim()) query = query.where(sql<boolean>`strpos(lower(normalize(coalesce(pages.title, ''), NFKC)), ${dto.query.normalize('NFKC').trim().toLowerCase()}) > 0`);
    const limit = dto.limit || 30;
    const candidates = await query.orderBy('pages.id', 'desc').limit(limit + 1).execute();
    const batch = candidates.slice(0, limit);
    const accessible = new Set(await this.permissions.filterAccessiblePageIds({ pageIds: batch.map(p => p.id), userId: user.id }));
    return { enabled: true, items: batch.filter(p => accessible.has(p.id)),
      nextCursor: candidates.length > limit ? classificationCursor(this.environment.getAppSecret(), user.id, user.workspaceId, batch[batch.length - 1].id) : null };
  }
  async page(pageId: string, user: User) {
    await this.allowed(user);
    const page = await this.pages.findById(pageId);
    if (!page || page.workspaceId !== user.workspaceId || page.deletedAt) throw new NotFoundException();
    await this.access.validateCanView(page, user, true);
    const config = await this.config(user);
    if (!config.enabled) return { enabled: false, labels: [] };
    const row = await this.base(user).select(labelExpression(config.rules).as('labels'))
      .where('pages.id', '=', page.id).executeTakeFirst();
    if (!row) throw new NotFoundException();
    return { enabled: true, labels: row.labels };
  }
}
