import { BadRequestException } from '@nestjs/common';
import { SetupInputPipe, LoginInputPipe, ChangePasswordInputPipe, PasswordResetInputPipe } from './personal-auth-input.pipe';

const transform = (Pipe: any, value: unknown, personal = true) =>
  new Pipe({ isPersonalMode: () => personal }).transform(value, { type: 'body', metatype: Object });

describe('mode-aware authentication input validation', () => {
  it.each([SetupInputPipe, LoginInputPipe])('accepts only a password and strips supplied identity fields in personal mode', async Pipe => {
    const dto = await transform(Pipe, { password: '가', email: 'another@example.com', name: 'Other', role: 'admin' });
    expect({ ...dto }).toEqual({ password: '가' });
    expect((await transform(Pipe, { password: 'x'.repeat(100000) })).password).toHaveLength(100000);
  });

  it.each([undefined, null, 1, false, [], {}, ''])('rejects an empty or nonstring personal password: %p', async password => {
    await expect(transform(SetupInputPipe, { password })).rejects.toBeInstanceOf(BadRequestException);
    await expect(transform(LoginInputPipe, { password })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('preserves whitespace instead of silently changing the password', async () => {
    expect((await transform(SetupInputPipe, { password: ' ' })).password).toBe(' ');
  });

  it('keeps identity fields and eight-character creation policy outside personal mode', async () => {
    await expect(transform(SetupInputPipe, { password: 'a' }, false)).rejects.toBeInstanceOf(BadRequestException);
    await expect(transform(LoginInputPipe, { password: 'validpassword' }, false)).rejects.toBeInstanceOf(BadRequestException);
    const dto = await transform(SetupInputPipe, { name: 'Owner', email: 'owner@example.com', password: 'validpassword' }, false);
    expect(dto.email).toBe('owner@example.com');
    await expect(transform(SetupInputPipe, { name: 'Owner', email: 'owner@example.com', password: 'a' }, false)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies the same personal policy to change/reset without weakening token validation', async () => {
    expect({ ...await transform(ChangePasswordInputPipe, { oldPassword: 'a', newPassword: '가' }) }).toEqual({ oldPassword: 'a', newPassword: '가' });
    expect((await transform(PasswordResetInputPipe, { token: 'reset-token', newPassword: 'a' })).newPassword).toBe('a');
    await expect(transform(PasswordResetInputPipe, { token: '', newPassword: 'a' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(transform(ChangePasswordInputPipe, { oldPassword: 'a', newPassword: '' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(transform(ChangePasswordInputPipe, { oldPassword: 'a', newPassword: 'b' }, false)).rejects.toBeInstanceOf(BadRequestException);
    await expect(transform(PasswordResetInputPipe, { token: 'token', newPassword: 'a' }, false)).rejects.toBeInstanceOf(BadRequestException);
  });
});
