import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import type { KyselyDB } from '@docmost/db/types/kysely.types';
import type { User } from '@docmost/db/types/entity.types';
import { PersonalWorkspaceAccess } from '../../core/personal-workspace/personal-workspace-access.service';
import {
  DEFAULT_SERVER_SETTINGS,
  normalizedSettings,
  type ServerSettings,
} from './server-settings.schema';

@Injectable()
export class ServerSettingsService {
  private cached?: { value: ServerSettings; until: number };
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly access: PersonalWorkspaceAccess,
  ) {}

  async snapshot(): Promise<ServerSettings> {
    if (this.cached && this.cached.until > Date.now())
      return structuredClone(this.cached.value);
    const row = await this.db
      .selectFrom('instanceSettings')
      .selectAll()
      .where('id', '=', 'server')
      .executeTakeFirst();
    const value = row
      ? {
          ...normalizedSettings({ ...DEFAULT_SERVER_SETTINGS, ...row.value }),
          revision: row.revision,
        }
      : structuredClone(DEFAULT_SERVER_SETTINGS);
    this.cached = { value, until: Date.now() + 2000 };
    return structuredClone(value);
  }
  async read(account: User) {
    this.access.assertOwner(account);
    return this.snapshot();
  }
  async update(account: User, input: ServerSettings): Promise<ServerSettings> {
    this.access.assertOwner(account);
    const value = normalizedSettings(input);
    const result = await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto('instanceSettings')
        .values({
          id: 'server',
          revision: 0,
          value: sql<string>`${JSON.stringify(DEFAULT_SERVER_SETTINGS)}::text::jsonb`,
        })
        .onConflict((oc) => oc.column('id').doNothing())
        .execute();
      const current = await trx
        .selectFrom('instanceSettings')
        .selectAll()
        .where('id', '=', 'server')
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (current.revision !== input.revision)
        throw new ConflictException(
          'Server settings changed; reload before saving',
        );
      const next = { ...value, revision: current.revision + 1 };
      await trx
        .updateTable('instanceSettings')
        .set({
          value: sql<string>`${JSON.stringify(value)}::text::jsonb`,
          revision: next.revision,
        })
        .where('id', '=', 'server')
        .execute();
      return next;
    });
    this.cached = { value: result, until: Date.now() + 2000 };
    return structuredClone(result);
  }
  private endpoint(base: string, route: string) {
    return new URL(route, base.replace(/\/$/, '') + '/');
  }
  async testGotenberg(account: User) {
    this.access.assertOwner(account);
    const settings = await this.snapshot();
    if (!settings.gotenbergUrl)
      return { connected: false, revision: settings.revision };
    try {
      const response = await fetch(
        this.endpoint(settings.gotenbergUrl, 'health'),
        { redirect: 'error', signal: AbortSignal.timeout(5000) },
      );
      await response.body?.cancel();
      return { connected: response.ok, revision: settings.revision };
    } catch {
      return { connected: false, revision: settings.revision };
    }
  }
  // Only an owner's explicit configured service receives the already-authorized,
  // locally rendered PDF. No document URLs, cookies or filesystem paths are sent.
  async processPdf(buffer: Buffer, revision: number): Promise<Buffer> {
    const settings = await this.snapshot();
    if (settings.revision !== revision)
      throw new ConflictException('PDF server settings changed; try again');
    if (!settings.gotenbergUrl) return buffer;
    const data = new FormData();
    data.set(
      'files',
      new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }),
      'document.pdf',
    );
    data.set('pdfa', 'PDF/A-2b');
    try {
      const response = await fetch(
        this.endpoint(settings.gotenbergUrl, 'forms/pdfengines/convert'),
        {
          method: 'POST',
          body: data,
          redirect: 'error',
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new Error();
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > 30_000_000) {
          await response.body.cancel().catch(() => {});
          throw new Error();
        }
        chunks.push(Buffer.from(chunk));
      }
      const pdf = Buffer.concat(chunks);
      if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error();
      return pdf;
    } catch {
      throw new ServiceUnavailableException({
        code: 'pdfExternal',
        message: 'The configured PDF server could not process this document',
      });
    }
  }
}
