import { Body, Controller, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { Equals, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { ALL_NAMED_THROTTLERS_SKIPPED, AUTH_THROTTLER } from '../../integrations/throttle/throttler-names';
import type { FastifyReply } from 'fastify';
import type { User, Workspace } from '@docmost/db/types/entity.types';
import { AuthAccountUser, AuthAccountWorkspace } from '../../common/decorators/auth-account.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequireSessionAuth } from '../../common/decorators/require-session-auth.decorator';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { PersonalWorkspaceService } from './personal-workspace.service';
import { PERSONAL_WORKSPACE_COOKIE, PersonalWorkspaceAccess } from './personal-workspace-access.service';
import { PersonalWorkspaceReset } from './personal-workspace-reset.service';

export class CreatePersonalWorkspaceDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(64) name: string;
  @IsUUID() creationKey: string;
}
export class SwitchPersonalWorkspaceDto { @IsUUID() workspaceId: string; }
export class DeletePersonalWorkspaceDto extends SwitchPersonalWorkspaceDto {
  @IsString() @MinLength(1) @MaxLength(64) confirmationName: string;
}
export class ResetPersonalWorkspaceDto {
  @Equals('RESET') confirmation: string;
  @IsString() @MinLength(1) confirmationPassword: string;
  @IsUUID() requestId: string;
}

@Controller('personal-workspaces')
@UseGuards(JwtAuthGuard)
@RequireSessionAuth()
export class PersonalWorkspaceController {
  constructor(private readonly service: PersonalWorkspaceService,
    private readonly access: PersonalWorkspaceAccess,
    private readonly environment: EnvironmentService,
    private readonly resetService: PersonalWorkspaceReset) {}

  @SkipThrottle({ ...ALL_NAMED_THROTTLERS_SKIPPED, [AUTH_THROTTLER]: false })
  @UseGuards(ThrottlerGuard)
  @Post('reset') @HttpCode(200)
  async reset(@AuthAccountUser() user: User, @Body() dto: ResetPersonalWorkspaceDto,
    @Res({ passthrough: true }) res: FastifyReply) {
    const result = await this.resetService.reset(user, dto.confirmationPassword, dto.requestId);
    res.setCookie(PERSONAL_WORKSPACE_COOKIE, result.fallbackWorkspaceId, {
      httpOnly: true, sameSite: 'lax', path: this.environment.getCookiePath(), secure: this.environment.isHttps(),
      expires: this.environment.getCookieExpiresIn(),
    });
    return result;
  }

  @Post('list') @HttpCode(200)
  list(@AuthAccountUser() user: User) { return this.service.list(user); }

  @Post('trash') @HttpCode(200)
  trash(@AuthAccountUser() user: User) { return this.service.trash(user); }

  @Post('delete') @HttpCode(200)
  async delete(@AuthAccountUser() user: User, @Body() dto: DeletePersonalWorkspaceDto,
    @Res({ passthrough: true }) res: FastifyReply) {
    const result = await this.service.delete(user, dto.workspaceId, dto.confirmationName);
    res.setCookie(PERSONAL_WORKSPACE_COOKIE, result.fallbackWorkspaceId, {
      httpOnly: true, sameSite: 'lax', path: this.environment.getCookiePath(), secure: this.environment.isHttps(),
      expires: this.environment.getCookieExpiresIn(),
    });
    return result;
  }

  @Post('restore') @HttpCode(200)
  restore(@AuthAccountUser() user: User, @Body() dto: SwitchPersonalWorkspaceDto) {
    return this.service.restore(user, dto.workspaceId);
  }

  @Post('create') @HttpCode(200)
  create(@AuthAccountUser() user: User, @Body() dto: CreatePersonalWorkspaceDto) {
    return this.service.create(user, dto.name, dto.creationKey);
  }

  @Post('switch') @HttpCode(200)
  async switchWorkspace(@AuthAccountUser() user: User, @AuthAccountWorkspace() workspace: Workspace,
    @Body() dto: SwitchPersonalWorkspaceDto, @Res({ passthrough: true }) res: FastifyReply) {
    this.access.assertOwner(user);
    const selected = await this.access.resolve(user, workspace, dto.workspaceId);
    res.setCookie(PERSONAL_WORKSPACE_COOKIE, selected.workspace.id, {
      httpOnly: true, sameSite: 'lax', path: this.environment.getCookiePath(), secure: this.environment.isHttps(),
      expires: this.environment.getCookieExpiresIn(),
    });
    return { id: selected.workspace.id };
  }
}
