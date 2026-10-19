import { UserRepo } from '@docmost/db/repos/user/user.repo';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { NotificationSettingKey } from '../notification/notification.constants';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import {
  comparePasswordHash,
  diffAuditTrackedFields,
} from 'src/common/helpers/utils';
import { Workspace } from '@docmost/db/types/entity.types';
import { validateSsoEnforcement } from '../auth/auth.util';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';

@Injectable()
export class UserService {
  constructor(
    private userRepo: UserRepo,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
    private readonly environmentService: EnvironmentService,
  ) {}

  async findById(userId: string, workspaceId: string) {
    return this.userRepo.findById(userId, workspaceId);
  }

  async update(
    updateUserDto: UpdateUserDto,
    userId: string,
    workspace: Workspace,
  ) {
    const notificationSettings: Record<string, NotificationSettingKey> = {
      notificationPageUpdates: 'page.updated',
      notificationPageUserMention: 'page.userMention',
      notificationCommentUserMention: 'comment.userMention',
      notificationCommentCreated: 'comment.created',
      notificationCommentResolved: 'comment.resolved',
    };
    if (
      this.environmentService.isPersonalMode() &&
      Object.keys(notificationSettings).some(
        (field) => updateUserDto[field] !== undefined,
      )
    ) {
      throw new BadRequestException(
        'Collaboration notification settings are unavailable in personal mode',
      );
    }

    const includePassword =
      updateUserDto.email != null && updateUserDto.confirmPassword != null;

    const user = await this.userRepo.findById(userId, workspace.id, {
      includePassword,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // preference update
    if (typeof updateUserDto.fullPageWidth !== 'undefined') {
      return this.userRepo.updatePreference(
        userId,
        'fullPageWidth',
        updateUserDto.fullPageWidth,
      );
    }

    if (typeof updateUserDto.pageEditMode !== 'undefined') {
      return this.userRepo.updatePreference(
        userId,
        'pageEditMode',
        updateUserDto.pageEditMode.toLowerCase(),
      );
    }

    if (typeof updateUserDto.editorToolbar !== 'undefined') {
      return this.userRepo.updatePreference(
        userId,
        'editorToolbar',
        updateUserDto.editorToolbar,
      );
    }

    if (updateUserDto.appFont !== undefined) {
      return this.userRepo.updatePreference(
        userId,
        'appFont',
        updateUserDto.appFont,
      );
    }

    if (updateUserDto.documentFont !== undefined) {
      return this.userRepo.updatePreference(
        userId,
        'documentFont',
        updateUserDto.documentFont,
      );
    }
    if (updateUserDto.smallText !== undefined) {
      return this.userRepo.updatePreference(
        userId,
        'smallText',
        updateUserDto.smallText,
      );
    }

    for (const [dtoField, settingKey] of Object.entries(notificationSettings)) {
      if (typeof updateUserDto[dtoField] !== 'undefined') {
        return this.userRepo.updateNotificationSetting(
          userId,
          settingKey,
          updateUserDto[dtoField],
        );
      }
    }

    const userBefore = {
      name: user.name,
      email: user.email,
      locale: user.locale,
    };

    if (updateUserDto.name) {
      user.name = updateUserDto.name;
    }

    if (updateUserDto.email && user.email != updateUserDto.email) {
      validateSsoEnforcement(workspace);

      if (!updateUserDto.confirmPassword) {
        throw new BadRequestException(
          'You must provide a password to change your email',
        );
      }

      const isPasswordMatch = await comparePasswordHash(
        updateUserDto.confirmPassword,
        user.password,
      );

      if (!isPasswordMatch) {
        throw new BadRequestException(
          'You must provide the correct password to change your email',
        );
      }

      if (await this.userRepo.findByEmail(updateUserDto.email, workspace.id)) {
        throw new BadRequestException('A user with this email already exists');
      }

      user.email = updateUserDto.email;
    }

    if (updateUserDto.locale) {
      user.locale = updateUserDto.locale;
    }

    delete updateUserDto.confirmPassword;

    await this.userRepo.updateUser(updateUserDto, userId, workspace.id);

    const changes = diffAuditTrackedFields(
      ['name', 'email'],
      updateUserDto,
      userBefore,
      user,
    );

    if (changes) {
      this.auditService.log({
        event: AuditEvent.USER_UPDATED,
        resourceType: AuditResource.USER,
        resourceId: userId,
        changes,
      });
    }

    return user;
  }
}
