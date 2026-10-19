import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  ArrayMaxSize,
  MaxLength,
  Min,
} from 'class-validator';
import { AuthAccountUser } from '../../common/decorators/auth-account.decorator';
import { RequireSessionAuth } from '../../common/decorators/require-session-auth.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { User } from '@docmost/db/types/entity.types';
import { ServerSettingsService } from './server-settings.service';
export class ServerSettingsDto {
  @IsInt() @Min(0) revision: number;
  @IsString() @MaxLength(2048) drawioUrl: string;
  @IsString() @MaxLength(2048) gotenbergUrl: string;
  @IsBoolean() iframeEmbedAllowed: boolean;
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  iframeAllowedOrigins: string[];
}
@Controller('server-settings')
@UseGuards(JwtAuthGuard)
@RequireSessionAuth()
export class ServerSettingsController {
  constructor(private readonly settings: ServerSettingsService) {}
  @Post('get') @HttpCode(200) get(@AuthAccountUser() account: User) {
    return this.settings.read(account);
  }
  @Post('update') @HttpCode(200) update(
    @AuthAccountUser() account: User,
    @Body() dto: ServerSettingsDto,
  ) {
    return this.settings.update(account, dto);
  }
  @Post('test-gotenberg') @HttpCode(200) test(
    @AuthAccountUser() account: User,
  ) {
    return this.settings.testGotenberg(account);
  }
}
