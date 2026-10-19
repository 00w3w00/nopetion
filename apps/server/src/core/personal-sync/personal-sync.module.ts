import { Body, Controller, HttpCode, Module, Post, UseGuards } from '@nestjs/common';
import { IsISO8601, IsString, IsUUID, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequireSessionAuth } from '../../common/decorators/require-session-auth.decorator';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import type { User } from '@docmost/db/types/entity.types';
import { PersonalSyncService } from './personal-sync.service';

export class SyncTitleDto {
  @IsUUID() pageId: string;
  @IsString() @MaxLength(500) title: string;
  @IsString() @MaxLength(500) expectedTitle: string;
  @IsISO8601() expectedUpdatedAt: string;
}
export class SyncAccessDto { @IsUUID() pageId: string; }

@Controller('personal-sync')
@UseGuards(JwtAuthGuard)
@RequireSessionAuth()
export class PersonalSyncController {
  constructor(private readonly sync: PersonalSyncService) {}
  @Post('access') @HttpCode(200)
  access(@Body() dto: SyncAccessDto, @AuthUser() user: User) { return this.sync.access(dto.pageId, user); }
  @Post('title') @HttpCode(200)
  title(@Body() dto: SyncTitleDto, @AuthUser() user: User) {
    return this.sync.title(dto, user);
  }
}

@Module({ controllers: [PersonalSyncController], providers: [PersonalSyncService] })
export class PersonalSyncModule {}
