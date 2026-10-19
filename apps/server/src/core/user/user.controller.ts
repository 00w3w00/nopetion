import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OAuthScope } from '../../common/decorators/oauth-scope.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { AuthAccountUser, AuthAccountWorkspace } from '../../common/decorators/auth-account.decorator';
import { personalUser } from '../personal-workspace/personal-workspace-access.service';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly workspaceRepo: WorkspaceRepo,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('me')
  @OAuthScope('read')
  async getUserInfo(
    @AuthUser() authUser: User,
    @AuthWorkspace() workspace: Workspace,
    @AuthAccountUser() account: User = authUser,
  ) {
    const memberCount = await this.workspaceRepo.getActiveUserCount(
      workspace.id,
    );

    const { licenseKey, ...rest } = workspace;

    const workspaceInfo = {
      ...rest,
      memberCount,
    };

    return { user: authUser, workspace: workspaceInfo, accountId: account.id };
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async updateUser(
    @Body() updateUserDto: UpdateUserDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @AuthAccountUser() account: User = user,
    @AuthAccountWorkspace() accountWorkspace: Workspace = workspace,
  ) {
    const updated = await this.userService.update(updateUserDto, account.id, accountWorkspace);
    return account.id === user.id ? updated : personalUser(updated, user);
  }
}
