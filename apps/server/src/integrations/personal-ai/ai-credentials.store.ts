import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
  chmodSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

export type AiProfile = {
  id: string;
  clientId: string;
  subject: string;
  email: string;
  model?: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number;
  scopes: string[];
};
export type AiAccount = { activeId?: string; profiles: AiProfile[] };

/** Independent, encrypted runtime storage. Never consult another app's credentials. */
@Injectable()
export class AiCredentialsStore {
  readonly directory = resolve(
    process.env.NOPETION_AI_DATA_DIR || 'data/personal-ai',
  );

  private atomic(file: string, data: string | Buffer) {
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    chmodSync(this.directory, 0o700);
    const temp = `${file}.${randomUUID()}.tmp`;
    writeFileSync(temp, data, { mode: 0o600, flag: 'wx' });
    renameSync(temp, file);
    chmodSync(file, 0o600);
  }

  private key(create: boolean): Buffer {
    const file = join(this.directory, 'encryption.key');
    if (existsSync(file)) {
      const key = readFileSync(file);
      if (key.length !== 32)
        throw new Error('AI credential encryption key is invalid.');
      return key;
    }
    if (
      !create ||
      (existsSync(this.directory) &&
        readdirSync(this.directory).some((name) => name.endsWith('.enc')))
    )
      throw new Error(
        'AI credential encryption key is missing. Restore the dedicated AI volume.',
      );
    const key = randomBytes(32);
    this.atomic(file, key);
    return key;
  }

  hostId(): string {
    const file = join(this.directory, 'host-id');
    if (existsSync(file)) return readFileSync(file, 'utf8');
    const id = `urn:uuid:${randomUUID()}`;
    this.atomic(file, id);
    return id;
  }

  private file(userId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(userId))
      throw new Error('Invalid AI account owner.');
    return join(this.directory, `${userId}.enc`);
  }

  read(userId: string): AiAccount {
    const file = this.file(userId);
    if (!existsSync(file)) return { profiles: [] };
    const packed = JSON.parse(readFileSync(file, 'utf8'));
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key(false),
      Buffer.from(packed.iv, 'base64'),
    );
    decipher.setAAD(Buffer.from(userId));
    decipher.setAuthTag(Buffer.from(packed.tag, 'base64'));
    const data = Buffer.concat([
      decipher.update(Buffer.from(packed.data, 'base64')),
      decipher.final(),
    ]);
    return JSON.parse(data.toString('utf8'));
  }

  write(userId: string, account: AiAccount) {
    // Refuse to generate a new key over existing encrypted records.
    const file = this.file(userId);
    const key = this.key(!existsSync(file));
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(userId));
    const data = Buffer.concat([
      cipher.update(JSON.stringify(account), 'utf8'),
      cipher.final(),
    ]);
    this.atomic(
      file,
      JSON.stringify({
        version: 1,
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        data: data.toString('base64'),
      }),
    );
  }
}
