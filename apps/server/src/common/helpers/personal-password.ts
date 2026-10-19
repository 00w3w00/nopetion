import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// Fixed, versioned parameters prevent a stored hash from choosing arbitrary work.
// 32 MiB / p=3 is one of OWASP's equivalent scrypt configurations.
const PREFIX = '$nopetion$scrypt$v1$';
const OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPersonalPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `${PREFIX}${salt.toString('hex')}$${key.toString('hex')}`;
}

export function isPersonalPasswordHash(hash: string): boolean {
  return hash.startsWith('$nopetion$');
}

export async function comparePersonalPassword(password: string, hash: string): Promise<boolean> {
  if (!hash.startsWith(PREFIX)) return false;
  const parts = hash.slice(PREFIX.length).split('$');
  if (parts.length !== 2 || !/^[a-f0-9]{32}$/.test(parts[0]) || !/^[a-f0-9]{64}$/.test(parts[1])) return false;
  const key = await derive(password, Buffer.from(parts[0], 'hex'));
  return timingSafeEqual(key, Buffer.from(parts[1], 'hex'));
}
