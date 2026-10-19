import { aiLocale, aiLanguageName, type AiLocale } from './ai-languages';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import type { Page, User } from '@docmost/db/types/entity.types';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import { EnvironmentService } from '../environment/environment.service';
import { AiCredentialsStore, type AiProfile } from './ai-credentials.store';
import {
  AI_PROVIDER,
  newAttempt,
  type OAuthAttempt,
  type PersonalAiProvider,
} from './openai-oauth.provider';
import { PrepareAiDto } from './personal-ai.dto';
import { readAiContext } from './ai-context';
import { aiLocalConnection, requireLocalAiSignIn } from './ai-oauth-local';

export function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export const sourceHash = (content: any) =>
  createHash('sha256').update(canonical(content)).digest('hex');
export function documentText(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  // Never read attachments, image URLs, transclusions or another document.
  if (
    ['image', 'video', 'audio', 'attachment', 'transclusion'].includes(
      node.type,
    )
  )
    return '';
  const children = Array.isArray(node.content) ? node.content : [];
  return children
    .map(documentText)
    .join(
      ['paragraph', 'heading', 'codeBlock'].includes(node.type) ? '' : '\n',
    );
}
const aiAccountId = (user: User) =>
  (user as User & { accountId?: string }).accountId || user.id;

export type AiPlan = {
  accountId: string;
  responseLocale: AiLocale;
  id: string;
  userId: string;
  pageId: string;
  sourceHash: string;
  title: string;
  action: string;
  scope: 'document' | 'selection';
  text: string;
  instruction: string;
  model: string;
  profileId: string;
  expiresAt: number;
};

@Injectable()
export class PersonalAiService {
  private attempts = new Map<string, OAuthAttempt>();
  private plans = new Map<string, AiPlan>();
  private locks = new Map<string, Promise<unknown>>();

  constructor(
    private store: AiCredentialsStore,
    @Inject(AI_PROVIDER) private provider: PersonalAiProvider,
    private pages: PageRepo,
    private access: PageAccessService,
    private environment: EnvironmentService,
  ) {}

  private enabled() {
    if (!this.environment.isPersonalMode())
      throw new ForbiddenException({
        message: '개인 모드에서 AI를 사용할 수 있습니다.',
        code: 'personalOnly',
      });
  }

  status(user: User, origin?: string, host?: string) {
    this.enabled();
    const account = this.store.read(aiAccountId(user)),
      active = account.profiles.find((p) => p.id === account.activeId);
    return {
      connected: !!active?.accessToken,
      activeId: account.activeId,
      model: active?.model || '',
      ...this.localConnection(origin, host),
      bridgeSettingsUrl: this.environment.getPersonalAiCallbackUrl()
        ? this.localConnection().localSettingsUrl
        : aiLocalConnection(this.environment.getAppUrl(), 31415).localSettingsUrl,
      profiles: account.profiles.map((p) => ({
        id: p.id,
        email: p.email,
        label: `${p.email || 'ChatGPT'} · ${p.id.slice(0, 6)}`,
        connected: !!p.accessToken,
      })),
    };
  }

  localConnection(origin?: string, host?: string) {
    return aiLocalConnection(
      this.environment.getAppUrl(),
      this.environment.getPort(),
      this.environment.getPersonalAiCallbackUrl(),
      origin,
      host,
    );
  }

  signIn(user: User, profileId?: string, origin?: string, host?: string) {
    this.enabled();
    const { callbackUrl } = this.localConnection(origin, host);
    requireLocalAiSignIn(callbackUrl, origin, host);
    const account = this.store.read(aiAccountId(user)),
      profile = profileId
        ? account.profiles.find((p) => p.id === profileId)
        : undefined;
    if (profileId && !profile)
      throw new NotFoundException({
        message: 'AI 계정을 찾을 수 없습니다.',
        code: 'profileNotFound',
      });
    for (const [key, attempt] of this.attempts)
      if (
        attempt.expiresAt < Date.now() ||
        attempt.userId === aiAccountId(user)
      )
        this.attempts.delete(key);
    if (this.attempts.size >= 100)
      throw new BadRequestException({
        message: '로그인 대기 요청이 너무 많습니다.',
        code: 'busy',
      });
    const attempt = newAttempt(aiAccountId(user), callbackUrl, profile);
    attempt.locale = aiLocale(user.locale);
    this.attempts.set(attempt.state, attempt);
    return {
      url: this.provider.authorize(attempt, this.store.hostId(), profile),
    };
  }

  callbackLocale(state?: string): AiLocale {
    const attempt = typeof state === 'string' && this.attempts.get(state);
    return aiLocale(
      attempt && attempt.expiresAt >= Date.now() ? attempt.locale : undefined,
    );
  }

  callbackUrlForState(state?: string): string {
    const attempt = typeof state === 'string' && this.attempts.get(state);
    return attempt && attempt.expiresAt >= Date.now() ? attempt.redirectUri : this.localConnection().callbackUrl;
  }

  async callback(query: Record<string, string>) {
    this.enabled();
    const attempt =
      typeof query.state === 'string' && this.attempts.get(query.state);
    if (!attempt || attempt.expiresAt < Date.now())
      throw new BadRequestException({
        message:
          'OAuth 요청이 만료되었거나 유효하지 않습니다. 앱에서 다시 로그인해 주세요.',
        code: 'oauthExpired',
      });
    this.attempts.delete(attempt.state); // Single-use before any network request.
    if (query.error)
      throw new BadRequestException({
        message: 'ChatGPT 로그인이 취소되었습니다. 기존 연결은 보존됩니다.',
        code: 'oauthCancelled',
      });
    const clientId = query.client_id || attempt.clientId;
    if (
      typeof query.code !== 'string' ||
      query.code.length > 4096 ||
      typeof clientId !== 'string' ||
      !/^oaiapp_[A-Za-z0-9_-]+$/.test(clientId) ||
      (attempt.clientId && attempt.clientId !== clientId)
    )
      throw new BadRequestException({
        message: 'OAuth 등록 정보를 확인하지 못했습니다.',
        code: 'oauthVerify',
      });
    const profile = await this.provider.exchange(attempt, query.code, clientId);
    await this.serial(attempt.userId, async () => {
      const account = this.store.read(attempt.userId),
        previous = account.profiles.find((p) => p.id === profile.id);
      if (previous?.model) profile.model = previous.model;
      account.profiles = account.profiles
        .filter((p) => p.id !== profile.id)
        .concat(profile);
      account.activeId = profile.id;
      this.store.write(attempt.userId, account);
      this.clearPlans(attempt.userId);
    });
  }

  private async serial<T>(userId: string, work: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(userId) || Promise.resolve();
    const next = previous.catch(() => undefined).then(work);
    this.locks.set(userId, next);
    try {
      return await next;
    } finally {
      if (this.locks.get(userId) === next) this.locks.delete(userId);
    }
  }

  private async profile(userId: string): Promise<AiProfile> {
    return this.serial(userId, async () => {
      const account = this.store.read(userId);
      let profile = account.profiles.find((p) => p.id === account.activeId);
      if (
        !profile?.accessToken ||
        !profile.refreshToken ||
        !profile.scopes.includes('chatgpt.tokens.use.direct')
      )
        throw new BadRequestException({
          message: '먼저 AI 설정에서 ChatGPT를 연결해 주세요.',
          code: 'connectFirst',
        });
      if (!profile.expiresAt || profile.expiresAt < Date.now() + 60_000) {
        profile = await this.provider.refresh(profile);
        account.profiles = account.profiles.map((p) =>
          p.id === profile.id ? profile : p,
        );
        this.store.write(userId, account);
      }
      return profile;
    });
  }

  async models(user: User) {
    this.enabled();
    return this.provider.models(await this.profile(aiAccountId(user)));
  }

  async settings(user: User, profileId: string, model?: string) {
    this.enabled();
    await this.serial(aiAccountId(user), async () => {
      const account = this.store.read(aiAccountId(user)),
        profile = account.profiles.find((p) => p.id === profileId);
      if (!profile?.accessToken)
        throw new BadRequestException({
          message: '해당 AI 계정에 다시 로그인해 주세요.',
          code: 'loginAgain',
        });
      if (model !== undefined) {
        const models = await this.provider.models(profile);
        if (!models.some((m) => m.slug === model))
          throw new BadRequestException({
            message: '계정에서 사용할 수 있는 모델을 선택해 주세요.',
            code: 'invalidModel',
          });
        profile.model = model;
      }
      account.activeId = profileId;
      this.store.write(aiAccountId(user), account);
      this.clearPlans(aiAccountId(user));
    });
    return this.status(user);
  }

  async disconnect(user: User, profileId: string) {
    this.enabled();
    return this.serial(aiAccountId(user), async () => {
      const account = this.store.read(aiAccountId(user)),
        profile = account.profiles.find((p) => p.id === profileId);
      if (!profile) throw new NotFoundException();
      const revoked = await this.provider.revoke(profile);
      delete profile.accessToken;
      delete profile.refreshToken;
      delete profile.idToken;
      delete profile.expiresAt;
      profile.scopes = [];
      if (account.activeId === profileId) delete account.activeId;
      this.store.write(aiAccountId(user), account);
      this.clearPlans(aiAccountId(user));
      for (const [key, attempt] of this.attempts)
        if (attempt.userId === aiAccountId(user)) this.attempts.delete(key);
      return {
        revoked,
        message: revoked
          ? 'AI 연결을 해제했습니다.'
          : '로컬 연결은 해제했지만 원격 철회를 확인하지 못했습니다. ChatGPT 설정에서 앱 연결도 해제해 주세요.',
      };
    });
  }

  private clearPlans(userId: string) {
    for (const [id, plan] of this.plans)
      if (
        plan.userId === userId ||
        plan.accountId === userId ||
        plan.expiresAt < Date.now()
      )
        this.plans.delete(id);
  }
  private async page(user: User, pageId: string, edit: boolean): Promise<Page> {
    const page = await this.pages.findById(pageId, { includeContent: true });
    if (
      !page ||
      page.workspaceId !== user.workspaceId ||
      page.deletedAt ||
      page.isBase
    )
      throw new NotFoundException({
        message: 'AI로 처리할 문서를 찾을 수 없습니다.',
        code: 'documentNotFound',
      });
    if (edit) await this.access.validateCanEdit(page, user);
    else await this.access.validateCanView(page, user);
    return page;
  }

  private async makePlan(user: User, dto: PrepareAiDto): Promise<AiPlan> {
    this.enabled();
    const page = await this.page(user, dto.pageId, dto.action !== 'ask');
    const hash = sourceHash(page.content);
    if (hash !== dto.sourceHash)
      throw new ConflictException({
        message: '문서 저장이 완료된 뒤 다시 준비해 주세요.',
        code: 'sourceChanged',
      });
    if ((dto.scope === 'document') !== (dto.action === 'ask'))
      throw new BadRequestException({
        message: '문서 질문 또는 선택 영역 편집을 선택해 주세요.',
        code: 'scope',
      });
    const fullText = documentText(page.content).trim();
    const text = dto.scope === 'selection' ? dto.selectedText : fullText;
    if (
      text == null ||
      text.length > 20_000 ||
      (dto.scope === 'selection' && (!text.trim() || !fullText.includes(text)))
    )
      throw new BadRequestException({
        message: '처리할 텍스트를 20,000자 이내로 선택해 주세요.',
        code: 'selection',
      });
    const responseLocale = aiLocale(dto.responseLocale || user.locale);
    const instructions = {
      ask: dto.instruction?.trim() || '',
      summary:
        'Summarize the selected text concisely. Return only the summary.',
      polish:
        'Polish the selected text while preserving its meaning. Return only the rewritten text.',
      translate: `Translate the selected text into ${aiLanguageName(dto.targetLanguage || responseLocale)}. Return only the translation.`,
    };
    if (dto.action === 'ask' && !dto.instruction?.trim())
      throw new BadRequestException({
        message: '작성하거나 바꿀 내용을 입력해 주세요.',
        code: 'input',
      });
    const profile = await this.profile(aiAccountId(user));
    if (!profile.model)
      throw new BadRequestException({
        message: 'AI 설정에서 계정의 모델을 선택해 주세요.',
        code: 'chooseModel',
      });
    const plan: AiPlan = {
      responseLocale,
      id: randomUUID(),
      userId: user.id,
      accountId: aiAccountId(user),
      pageId: page.id,
      sourceHash: hash,
      title: page.title || '',
      action: dto.action,
      scope: dto.scope,
      text,
      instruction: instructions[dto.action],
      model: profile.model,
      profileId: profile.id,
      expiresAt: Date.now() + 5 * 60_000,
    };
    return plan;
  }

  async prepare(user: User, dto: PrepareAiDto) {
    const plan = await this.makePlan(user, dto);
    this.clearPlans(user.id);
    if (this.plans.size >= 100)
      throw new BadRequestException({
        message: 'AI 대기 요청이 너무 많습니다.',
        code: 'busy',
      });
    this.plans.set(plan.id, plan);
    return {
      responseLocale: plan.responseLocale,
      id: plan.id,
      title: plan.title,
      sourceHash: plan.sourceHash,
      text: plan.text,
      instruction: plan.instruction,
      model: plan.model,
      expiresAt: plan.expiresAt,
      provider: 'ChatGPT OAuth',
    };
  }

  async execute(user: User, id: string, approved: boolean) {
    this.enabled();
    const plan = this.plans.get(id);
    if (!plan || plan.userId !== user.id || plan.expiresAt < Date.now())
      throw new BadRequestException({
        message: '전송 미리보기가 만료되었습니다. 다시 준비해 주세요.',
        code: 'expired',
      });
    if (approved !== true)
      throw new BadRequestException({
        message: '문서 전송을 명시적으로 승인해야 합니다.',
        code: 'approval',
      });
    this.plans.delete(id);
    return this.generatePlan(user, plan);
  }

  async backgroundPlan(user: User, dto: PrepareAiDto): Promise<AiPlan> {
    return this.makePlan(user, dto);
  }

  async generatePlan(user: User, plan: AiPlan) {
    this.enabled();
    if (plan.userId !== user.id || plan.accountId !== aiAccountId(user))
      throw new ForbiddenException();
    const page = await this.page(user, plan.pageId, plan.action !== 'ask');
    if (
      sourceHash(page.content) !== plan.sourceHash ||
      (page.title || '') !== plan.title
    )
      throw new ConflictException({
        message: '원문이 변경되어 전송을 취소했습니다. 다시 준비해 주세요.',
        code: 'sourceChanged',
      });
    const profile = await this.profile(aiAccountId(user));
    if (profile.id !== plan.profileId || profile.model !== plan.model)
      throw new ConflictException({
        message: 'AI 계정 또는 모델이 변경되었습니다. 다시 준비해 주세요.',
        code: 'accountChanged',
      });
    const context = await readAiContext(
      { scope: plan.scope, text: plan.text },
      plan.responseLocale,
    );
    const text = await this.provider.generate(
      profile,
      plan.model,
      plan.instruction,
      context.source,
      context.guidance,
    );
    return { text, sourceHash: plan.sourceHash, pageId: plan.pageId };
  }
}
