import { Body, Controller, HttpCode, Module, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequireSessionAuth } from '../../common/decorators/require-session-auth.decorator';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import type { User } from '@docmost/db/types/entity.types';
import { PersonalClassificationService } from './personal-classification.service';
import type { ClassificationRule } from './classification.rules';

export class ClassificationConfigDto {
  @IsBoolean() enabled: boolean;
  @IsArray() rules: ClassificationRule[];
  @IsOptional() @IsUUID() expectedRevision?: string;
}
export class ClassificationPagesDto {
  @IsOptional() @IsString() @MaxLength(64) ruleId?: string;
  @IsOptional() @IsString() @MaxLength(200) cursor?: string;
  @IsOptional() @IsUUID() spaceId?: string;
  @IsOptional() @IsString() @MaxLength(200) query?: string;
  @IsOptional() @IsInt() @Min(1) @Max(50) limit?: number;
}
export class ClassificationPageDto { @IsUUID() pageId: string; }

@Controller('personal-classification')
@UseGuards(JwtAuthGuard)
@RequireSessionAuth()
export class PersonalClassificationController {
  constructor(private readonly service: PersonalClassificationService) {}
  @Post('config') @HttpCode(200)
  config(@AuthUser() user: User) { return this.service.config(user); }
  @Post('configure') @HttpCode(200)
  configure(@Body() dto: ClassificationConfigDto, @AuthUser() user: User) { return this.service.configure(dto, user); }
  @Post('pages') @HttpCode(200)
  pages(@Body() dto: ClassificationPagesDto, @AuthUser() user: User) { return this.service.list(dto, user); }
  @Post('page') @HttpCode(200)
  page(@Body() dto: ClassificationPageDto, @AuthUser() user: User) { return this.service.page(dto.pageId, user); }
}

@Module({ controllers: [PersonalClassificationController], providers: [PersonalClassificationService], exports: [PersonalClassificationService] })
export class PersonalClassificationModule {}
