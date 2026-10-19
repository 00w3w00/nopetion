import {
  BadRequestException,
  GoneException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';
import { PersonalPasswordDto } from '../dto/personal-auth-input.pipe';
import { CreateUserDto } from '../dto/create-user.dto';
import { TokenService } from './token.service';
import { SessionService } from '../../session/session.service';
import { UserSessionRepo } from '@docmost/db/repos/session/user-session.repo';
import { SignupService } from './signup.service';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import {
  comparePasswordHash,
  hashPassword,
  isUserDisabled,
} from '../../../common/helpers';
import { throwIfEmailNotVerified } from '../auth.util';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { MailService } from '../../../integrations/mail/mail.service';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { UserTokenRepo } from '@docmost/db/repos/user-token/user-token.repo';
import { PasswordResetDto } from '../dto/password-reset.dto';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { InjectKysely } from 'nestjs-kysely';
import { executeTx } from '@docmost/db/utils';
import { VerifyUserTokenDto } from '../dto/verify-user-token.dto';
import { DomainService } from '../../../integrations/environment/domain.service';
import { AuditEvent, AuditResource } from '../../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../../integrations/audit/audit.service';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventName } from '../../../common/events/event.contants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private signupService: SignupService,
    private tokenService: TokenService,
    private sessionService: SessionService,
    private userSessionRepo: UserSessionRepo,
    private userRepo: UserRepo,
    private userTokenRepo: UserTokenRepo,
    private mailService: MailService,
    private domainService: DomainService,
    private environmentService: EnvironmentService,
    private eventEmitter: EventEmitter2,
    @InjectKysely() private readonly db: KyselyDB,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  async login(loginDto: LoginDto | PersonalPasswordDto, workspaceId: string) {
    const user = this.environmentService.isPersonalMode()
      ? await this.userRepo.findPersonalLoginOwner(workspaceId)
      : await this.userRepo.findByEmail((loginDto as LoginDto).email, workspaceId, {
      includePassword: true,
      includeUserMfa: true,
    });

    const errorMessage = this.environmentService.isPersonalMode() ? 'Password does not match' : 'Email or password does not match';
    if (!user || isUserDisabled(user) || (this.environmentService.isPersonalMode() && user.role !== 'owner')) {
      throw new UnauthorizedException(errorMessage);
    }

    const isPasswordMatch = await comparePasswordHash(
      loginDto.password,
      user.password,
    );

    if (!isPasswordMatch) {
      throw new UnauthorizedException(errorMessage);
    }

    if (user["mfa"]?.isEnabled) {
      throw new UnauthorizedException("This account requires MFA, which is unavailable in this build");
    }

    throwIfEmailNotVerified({
      isCloud: this.environmentService.isCloud(),
      emailVerifiedAt: user.emailVerifiedAt,
      email: user.email,
      workspaceId,
      appSecret: this.environmentService.getAppSecret(),
    });

    user.lastLoginAt = new Date();
    await this.userRepo.updateLastLogin(user.id, workspaceId);

    this.auditService.log({
      event: AuditEvent.USER_LOGIN,
      resourceType: AuditResource.USER,
      resourceId: user.id,
      metadata: { source: 'password' },
    });

    return this.sessionService.createSessionAndToken(user);
  }

  async register(createUserDto: CreateUserDto, workspaceId: string) {
    const user = await this.signupService.signup(createUserDto, workspaceId);
    return this.sessionService.createSessionAndToken(user);
  }

  async setup(input: CreateAdminUserDto | PersonalPasswordDto) {
    const createAdminUserDto: CreateAdminUserDto = this.environmentService.isPersonalMode()
      ? { password: input.password, name: '나', email: 'owner@nopetion.invalid', workspaceName: 'Nopetion' }
      : input as CreateAdminUserDto;
    const { workspace, user } =
      await this.signupService.initialSetup(createAdminUserDto);

    const authToken = await this.sessionService.createSessionAndToken(user);
    return { workspace, authToken };
  }

  async changePassword(
    dto: ChangePasswordDto,
    userId: string,
    workspaceId: string,
    currentSessionId?: string,
  ): Promise<void> {
    const user = await this.userRepo.findById(userId, workspaceId, {
      includePassword: true,
    });

    if (!user || isUserDisabled(user)) {
      throw new NotFoundException('User not found');
    }

    const comparePasswords = await comparePasswordHash(
      dto.oldPassword,
      user.password,
    );

    if (!comparePasswords) {
      throw new BadRequestException('Current password is incorrect');
    }

    const newPasswordHash = await hashPassword(dto.newPassword, this.environmentService.isPersonalMode());
    await this.userRepo.updateUser(
      {
        password: newPasswordHash,
        hasGeneratedPassword: false,
      },
      userId,
      workspaceId,
    );

    if (currentSessionId) {
      await this.userSessionRepo.deleteAllExceptCurrent(
        currentSessionId,
        userId,
        workspaceId,
      );
    } else {
      await this.userSessionRepo.deleteByUserId(userId, workspaceId);
    }

    this.auditService.log({
      event: AuditEvent.USER_PASSWORD_CHANGED,
      resourceType: AuditResource.USER,
      resourceId: userId,
    });

  }

  async forgotPassword(_dto: ForgotPasswordDto, _workspace: Workspace): Promise<void> {
    throw new GoneException('Email password recovery is not available');
  }

  async passwordReset(_dto: PasswordResetDto, _workspace: Workspace): Promise<{ requiresLogin: boolean; authToken: string }> {
    throw new GoneException('Email password recovery is not available');
  }

  async verifyUserToken(_dto: VerifyUserTokenDto, _workspaceId: string): Promise<void> {
    throw new GoneException('Email password recovery is not available');
  }

  async getCollabToken(user: User, workspaceId: string, account: User, sessionId: string) {
    const token = await this.tokenService.generateCollabToken(
      user,
      workspaceId,
      account,
      sessionId,
    );
    return { token };
  }
}
