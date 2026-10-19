import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { hashPassword } from '../../../common/helpers';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('personal canonical owner authentication', () => {
    let password: string;
    const workspaceId = 'canonical-workspace';
    let repo: any;
    let session: any;
    let signup: any;
    let personal: boolean;
    const owner = () => ({ id: 'owner', workspaceId, role: 'owner', email: 'existing@example.com', name: 'Existing', password, emailVerifiedAt: new Date() });

    beforeAll(async () => { password = await hashPassword('가', true); });
    beforeEach(() => {
      personal = true;
      repo = { findPersonalLoginOwner: jest.fn().mockResolvedValue(owner()), findByEmail: jest.fn().mockResolvedValue(owner()), updateLastLogin: jest.fn() };
      session = { createSessionAndToken: jest.fn().mockResolvedValue('session-token') };
      signup = { initialSetup: jest.fn().mockResolvedValue({ user: owner(), workspace: { id: workspaceId } }) };
      Object.assign(service, { userRepo: repo, sessionService: session, signupService: signup, auditService: { log: jest.fn() }, environmentService: { isPersonalMode: () => personal, isCloud: () => false, getAppSecret: () => 'unit-fixture-secret' } });
    });

    it('logs into the original owner without an email lookup or account creation', async () => {
      expect(await service.login({ password: '가' }, workspaceId)).toBe('session-token');
      expect(repo.findPersonalLoginOwner).toHaveBeenCalledWith(workspaceId);
      expect(repo.findByEmail).not.toHaveBeenCalled();
      expect(signup.initialSetup).not.toHaveBeenCalled();
      expect(session.createSessionAndToken).toHaveBeenCalledWith(expect.objectContaining({ id: 'owner' }));
    });

    it('does not let supplied identity fields select another account', async () => {
      expect(await service.login({ password: '가', email: 'other@example.com' }, workspaceId)).toBe('session-token');
      expect(repo.findByEmail).not.toHaveBeenCalled();
    });

    it.each([undefined, { role: 'member' }, { deactivatedAt: new Date() }, { deletedAt: new Date() }, { mfa: { isEnabled: true } }])('fails closed for unavailable, nonowner, disabled and MFA accounts: %p', async patch => {
      repo.findPersonalLoginOwner.mockResolvedValue(patch ? { ...owner(), ...patch } : undefined);
      await expect(service.login({ password: '가' }, workspaceId)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(session.createSessionAndToken).not.toHaveBeenCalled();
    });

    it('does not create a session for an incorrect password', async () => {
      await expect(service.login({ password: 'wrong' }, workspaceId)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(session.createSessionAndToken).not.toHaveBeenCalled();
    });

    it('creates default account metadata only through the existing serialized initial-setup service', async () => {
      await service.setup({ password: '가' });
      expect(signup.initialSetup).toHaveBeenCalledWith({ password: '가', name: '나', email: 'owner@nopetion.invalid', workspaceName: 'Nopetion' });
    });

    it('keeps email login outside personal mode', async () => {
      personal = false;
      await service.login({ email: 'existing@example.com', password: '가' }, workspaceId);
      expect(repo.findByEmail).toHaveBeenCalledWith('existing@example.com', workspaceId, { includePassword: true, includeUserMfa: true });
      expect(repo.findPersonalLoginOwner).not.toHaveBeenCalled();
    });

    it('rejects removed email recovery before looking up an account', async () => {
      repo.findByEmail.mockResolvedValue({ ...owner(), email: 'owner@nopetion.invalid' });
      await expect(service.forgotPassword({ email: 'owner@nopetion.invalid' }, { id: workspaceId } as any)).rejects.toMatchObject({ status: 410 });
      await expect(service.passwordReset({ token: 'legacy-token', newPassword: 'new-password' }, { id: workspaceId } as any)).rejects.toMatchObject({ status: 410 });
      await expect(service.verifyUserToken({ token: 'legacy-token', type: 'password-reset' } as any, workspaceId)).rejects.toMatchObject({ status: 410 });
      expect(repo.findByEmail).not.toHaveBeenCalled();
    });
  });
});
