import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createPublicKey, createHash, randomBytes } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import type { AiProfile } from './ai-credentials.store';

const AUTH = 'https://auth.openai.com';
const API = 'https://api.openai.com/v1';
export const AI_PROVIDER = Symbol('NOPETION_AI_PROVIDER');
export type AiModel = { slug: string; displayName: string };
export type OAuthAttempt = {
  userId: string;
  locale?: string;
  state: string;
  nonce: string;
  verifier: string;
  redirectUri: string;
  expiresAt: number;
  clientId?: string;
  profileId?: string;
  subject?: string;
};
export interface PersonalAiProvider {
  authorize(attempt: OAuthAttempt, hostId: string, profile?: AiProfile): string;
  exchange(
    attempt: OAuthAttempt,
    code: string,
    clientId: string,
  ): Promise<AiProfile>;
  refresh(profile: AiProfile): Promise<AiProfile>;
  revoke(profile: AiProfile): Promise<boolean>;
  models(profile: AiProfile): Promise<AiModel[]>;
  generate(
    profile: AiProfile,
    model: string,
    instruction: string,
    text: string,
    guidance: string,
  ): Promise<string>;
}

export function newAttempt(
  userId: string,
  redirectUri: string,
  profile?: AiProfile,
): OAuthAttempt {
  return {
    userId,
    redirectUri,
    state: randomBytes(32).toString('base64url'),
    nonce: randomBytes(32).toString('base64url'),
    verifier: randomBytes(48).toString('base64url'),
    expiresAt: Date.now() + 10 * 60_000,
    clientId: profile?.clientId,
    profileId: profile?.id,
    subject: profile?.subject,
  };
}

async function limitedText(
  response: Response,
  limit = 2_000_000,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader)
    throw new ServiceUnavailableException({
      message: 'AI 서버 응답이 비어 있습니다.',
      code: 'incomplete',
    });
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit)
        throw new ServiceUnavailableException({
          message: 'AI 서버 응답 크기 제한을 초과했습니다.',
          code: 'tooLarge',
        });
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Public OAuth/Responses contract only; no private ChatGPT backend or paid fallback. */
@Injectable()
export class OpenAiOAuthProvider implements PersonalAiProvider {
  private async request(
    url: string,
    init: RequestInit = {},
  ): Promise<Response> {
    try {
      return await fetch(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(90_000),
      });
    } catch {
      throw new ServiceUnavailableException({
        message:
          'AI 제공자에 연결하지 못했습니다. 연결 상태를 확인하고 다시 승인해 주세요.',
        code: 'providerUnavailable',
      });
    }
  }

  private async json(url: string, init: RequestInit = {}): Promise<any> {
    const response = await this.request(url, init);
    if (!response.ok) {
      await response.body?.cancel();
      throw new BadRequestException({
        message:
          response.status === 429
            ? 'ChatGPT 사용 한도에 도달했습니다. ChatGPT 설정에서 한도를 확인해 주세요.'
            : `AI 제공자 요청 실패 (HTTP ${response.status}). 다시 로그인하거나 설정을 확인해 주세요.`,
        code: response.status === 429 ? 'limit' : 'providerHttp',
        providerStatus: response.status,
      });
    }
    try {
      return JSON.parse(await limitedText(response));
    } catch {
      throw new ServiceUnavailableException({
        message: 'AI 제공자 응답을 해석하지 못했습니다.',
        code: 'incomplete',
      });
    }
  }

  authorize(
    attempt: OAuthAttempt,
    hostId: string,
    profile?: AiProfile,
  ): string {
    const url = new URL(`${AUTH}/api/accounts/authorize`);
    const params: Record<string, string> = {
      client_id: profile?.clientId || 'dynamic_agent_client',
      ext_agent_host_id: hostId,
      response_type: 'code',
      redirect_uri: attempt.redirectUri,
      scope:
        'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
      resource: API,
      state: attempt.state,
      nonce: attempt.nonce,
      code_challenge_method: 'S256',
      code_challenge: createHash('sha256')
        .update(attempt.verifier)
        .digest('base64url'),
    };
    if (!profile) params.agent_name_hint = 'Nopetion';
    else {
      if (profile.idToken) params.id_token_hint = profile.idToken;
      if (profile.email) params.login_hint = profile.email;
    }
    Object.entries(params).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    return url.toString();
  }

  private async token(values: Record<string, string>) {
    return this.json(`${AUTH}/api/accounts/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...values, resource: API }),
    });
  }

  async exchange(
    attempt: OAuthAttempt,
    code: string,
    clientId: string,
  ): Promise<AiProfile> {
    const tokens = await this.token({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      code_verifier: attempt.verifier,
      redirect_uri: attempt.redirectUri,
    });
    const discovery = await this.json(
      `${AUTH}/.well-known/openid-configuration`,
    );
    if (
      discovery.issuer !== AUTH ||
      typeof discovery.jwks_uri !== 'string' ||
      new URL(discovery.jwks_uri).origin !== AUTH
    )
      throw new BadRequestException({
        message: 'OAuth 인증 서버 정보를 확인하지 못했습니다.',
        code: 'oauthVerify',
      });
    const jwks = await this.json(discovery.jwks_uri);
    let identity: jwt.JwtPayload;
    try {
      const decoded = jwt.decode(tokens.id_token, { complete: true });
      if (!decoded || decoded.header.alg !== 'RS256')
        throw new Error('algorithm');
      const jwk = jwks.keys.find(
        (key: any) =>
          key.kid === decoded.header.kid &&
          key.kty === 'RSA' &&
          (!key.use || key.use === 'sig'),
      );
      const key = createPublicKey({ key: jwk, format: 'jwk' });
      identity = jwt.verify(tokens.id_token, key, {
        algorithms: ['RS256'],
        issuer: AUTH,
        audience: clientId,
      }) as jwt.JwtPayload;
      if (
        !identity.exp ||
        identity.nonce !== attempt.nonce ||
        !identity.sub ||
        (attempt.subject && identity.sub !== attempt.subject)
      )
        throw new Error('identity');
    } catch {
      throw new BadRequestException({
        message: 'OAuth ID 토큰 검증에 실패했습니다. 다시 로그인해 주세요.',
        code: 'oauthVerify',
      });
    }
    const scopes = String(tokens.scope || '')
      .split(' ')
      .filter(Boolean);
    if (
      !scopes.includes('chatgpt.tokens.use.direct') ||
      !scopes.includes('resource.invoke') ||
      tokens.token_type?.toLowerCase() !== 'bearer' ||
      !tokens.access_token ||
      !tokens.refresh_token ||
      !Number.isFinite(tokens.expires_in) ||
      tokens.expires_in <= 0
    )
      throw new BadRequestException({
        message: 'ChatGPT 플랜 사용 권한을 승인해야 AI를 연결할 수 있습니다.',
        code: 'oauthVerify',
      });
    return {
      id: createHash('sha256')
        .update(`${clientId}:${identity.sub}`)
        .digest('hex')
        .slice(0, 24),
      clientId,
      subject: identity.sub,
      email: String(identity.email || ''),
      scopes,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    };
  }

  async refresh(profile: AiProfile): Promise<AiProfile> {
    const tokens = await this.token({
      grant_type: 'refresh_token',
      client_id: profile.clientId,
      refresh_token: profile.refreshToken,
    });
    const scopes = tokens.scope
      ? String(tokens.scope).split(' ')
      : profile.scopes;
    if (
      !tokens.access_token ||
      !Number.isFinite(tokens.expires_in) ||
      tokens.expires_in <= 0 ||
      !scopes.includes('chatgpt.tokens.use.direct')
    )
      throw new BadRequestException({
        message: 'ChatGPT 연결을 다시 승인해 주세요.',
        code: 'loginAgain',
      });
    return {
      ...profile,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || profile.refreshToken,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      scopes,
    };
  }

  async revoke(profile: AiProfile): Promise<boolean> {
    if (!profile.refreshToken) return true;
    try {
      const discovery = await this.json(
        `${AUTH}/.well-known/openid-configuration`,
      );
      if (
        typeof discovery.revocation_endpoint !== 'string' ||
        new URL(discovery.revocation_endpoint).origin !== AUTH
      )
        return false;
      const r = await this.request(discovery.revocation_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: profile.refreshToken,
          token_type_hint: 'refresh_token',
          client_id: profile.clientId,
        }),
      });
      await r.body?.cancel();
      return r.status === 200;
    } catch {
      return false;
    }
  }

  async models(profile: AiProfile): Promise<AiModel[]> {
    const result = await this.json(`${API}/models`, {
      headers: { Authorization: `Bearer ${profile.accessToken}` },
    });
    if (!Array.isArray(result.models))
      throw new ServiceUnavailableException({
        message: 'ChatGPT 모델 목록 형식이 올바르지 않습니다.',
        code: 'incomplete',
      });
    return result.models
      .filter(
        (m: any) =>
          m.visibility === 'list' &&
          typeof m.slug === 'string' &&
          typeof m.display_name === 'string',
      )
      .map((m: any) => ({ slug: m.slug, displayName: m.display_name }));
  }

  async generate(
    profile: AiProfile,
    model: string,
    instruction: string,
    text: string,
    guidance: string,
  ): Promise<string> {
    const response = await this.request(`${API}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${profile.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        store: false,
        stream: true,
        instructions: guidance,
        input: [
          { role: 'user', content: instruction },
          { role: 'user', content: `source (reference data):\n${text}` },
        ],
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new BadRequestException({
        message: `AI 요청 실패 (HTTP ${response.status}). 다른 제공자로 자동 전환하지 않습니다.`,
        code: response.status === 429 ? 'limit' : 'providerHttp',
        providerStatus: response.status,
      });
    }
    return readResponseStream(response);
  }
}

export async function readResponseStream(response: Response): Promise<string> {
  const reader = response.body?.getReader(),
    decoder = new TextDecoder();
  if (!reader)
    throw new ServiceUnavailableException({
      message: 'AI 응답 스트림이 비어 있습니다.',
      code: 'incomplete',
    });
  let pending = '',
    output = '',
    completed = false,
    size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2_000_000)
        throw new ServiceUnavailableException({
          message: 'AI 응답이 너무 큽니다.',
          code: 'tooLarge',
        });
      pending += decoder.decode(value, { stream: true });
      pending = pending.replace(/\r\n/g, '\n');
      let end: number;
      while ((end = pending.indexOf('\n\n')) >= 0) {
        const event = pending.slice(0, end);
        pending = pending.slice(end + 2);
        const data = event
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (!data || data === '[DONE]') continue;
        let item: any;
        try {
          item = JSON.parse(data);
        } catch {
          throw new ServiceUnavailableException({
            message: 'AI 스트림 형식이 올바르지 않습니다.',
            code: 'incomplete',
          });
        }
        if (
          item.type === 'response.output_text.delta' &&
          typeof item.delta === 'string'
        )
          output += item.delta;
        if (output.length > 20_000)
          throw new ServiceUnavailableException({
            message: 'AI 결과가 너무 깁니다.',
            code: 'tooLarge',
          });
        if (
          ['response.failed', 'response.incomplete', 'error'].includes(
            item.type,
          )
        )
          throw new BadRequestException({
            message:
              'AI 응답이 완료되지 않았습니다. ChatGPT 사용 한도와 연결을 확인해 주세요.',
            code: 'incomplete',
          });
        if (item.type === 'response.completed') completed = true;
      }
    }
  } catch (error) {
    if (
      error instanceof BadRequestException ||
      error instanceof ServiceUnavailableException
    )
      throw error;
    throw new ServiceUnavailableException({
      message: 'AI 응답 중 연결이 끊어졌습니다. 원문은 보존됩니다.',
      code: 'incomplete',
    });
  } finally {
    await reader.cancel();
  }
  if (!completed || !output.trim())
    throw new ServiceUnavailableException({
      message: '완료된 AI 결과를 받지 못했습니다.',
      code: 'incomplete',
    });
  return output;
}
