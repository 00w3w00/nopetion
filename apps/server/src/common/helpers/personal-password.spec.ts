import * as bcrypt from 'bcrypt';
import { hashPassword, comparePasswordHash } from './utils';

describe('full-length personal password hashes with existing password compatibility', () => {
  it.each(['a', '가', '🔐', ' ', '\0', '한글 🔐 '.repeat(800)])('verifies a nonempty password without trimming or truncation', async password => {
    const hash = await hashPassword(password, true);
    expect(hash).toMatch(/^\$nopetion\$scrypt\$v1\$/);
    expect(await comparePasswordHash(password, hash)).toBe(true);
    expect(await comparePasswordHash(password + 'x', hash)).toBe(false);
  });

  it('distinguishes suffixes after the legacy bcrypt 72-byte boundary', async () => {
    const prefix = '가'.repeat(24);
    const hash = await hashPassword(prefix + 'first', true);
    expect(await comparePasswordHash(prefix + 'first', hash)).toBe(true);
    expect(await comparePasswordHash(prefix + 'second', hash)).toBe(false);
    expect(await comparePasswordHash(prefix, hash)).toBe(false);
  });

  it('uses a fresh salt and does not normalize Unicode or remove surrounding spaces', async () => {
    const password = ' 가 ';
    const hash = await hashPassword(password, true);
    expect(await hashPassword(password, true)).not.toBe(hash);
    expect(await comparePasswordHash(password.trim(), hash)).toBe(false);
    expect(await comparePasswordHash(password.normalize('NFD'), hash)).toBe(false);
  });

  it.each(['$nopetion$scrypt$v2$bad', '$nopetion$scrypt$v1$00$00', '$nopetion$scrypt$v1$' + 'f'.repeat(32) + '$' + '0'.repeat(64) + '$extra'])('rejects malformed or unknown formats', async hash => {
    expect(await comparePasswordHash('a', hash)).toBe(false);
  });

  it('keeps existing bcrypt password verification and nonpersonal hash creation', async () => {
    const hash = await bcrypt.hash('existing password', 4);
    expect(await comparePasswordHash('existing password', hash)).toBe(true);
    expect(await comparePasswordHash('wrong', hash)).toBe(false);
    expect(await hashPassword('standard password')).toMatch(/^\$2[ab]\$/);
    expect(await comparePasswordHash('a', null)).toBe(false);
  });
});
