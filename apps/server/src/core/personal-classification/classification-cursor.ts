import { BadRequestException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const key = (secret: string) => createHash('sha256').update('nopetion:classification-cursor:v1:').update(secret).digest();
const context = (userId: string, workspaceId: string) => Buffer.from(JSON.stringify([userId, workspaceId]));

export function classificationCursor(secret: string, userId: string, workspaceId: string, id: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  cipher.setAAD(context(userId, workspaceId));
  const body = Buffer.concat([cipher.update(JSON.stringify({ id, expires: Date.now() + 3600000 })), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}
export function readClassificationCursor(secret: string, userId: string, workspaceId: string, value: string) {
  try {
    if (!/^[a-zA-Z0-9_-]{60,200}$/.test(value)) throw new Error();
    const bytes = Buffer.from(value, 'base64url');
    const cipher = createDecipheriv('aes-256-gcm', key(secret), bytes.subarray(0, 12));
    cipher.setAAD(context(userId, workspaceId)); cipher.setAuthTag(bytes.subarray(12, 28));
    const decoded = JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString());
    if (typeof decoded.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(decoded.id) || !Number.isFinite(decoded.expires) || decoded.expires < Date.now()) throw new Error();
    return decoded.id as string;
  } catch { throw new BadRequestException('Classification cursor expired or unavailable; reload the list'); }
}
