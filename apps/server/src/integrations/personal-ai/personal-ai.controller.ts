import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { requireLocalAiCallback } from './ai-oauth-local';
import type { User } from '@docmost/db/types/entity.types';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequireSessionAuth } from '../../common/decorators/require-session-auth.decorator';
import { PersonalAiService } from './personal-ai.service';
import { PersonalAiJobsService } from './personal-ai-jobs.service';
import { aiCallbackMessages } from './ai-callback-language';
import {
  ExecuteAiDto,
  PrepareAiDto,
  ProfileAiDto,
  SettingsAiDto,
  StartAiJobDto,
  AiJobsDto,
} from './personal-ai.dto';

@Controller('personal-ai')
@RequireSessionAuth()
export class PersonalAiController {
  constructor(private ai: PersonalAiService, private jobs: PersonalAiJobsService) {}
  @UseGuards(JwtAuthGuard)
  @Post('jobs/create')
  @HttpCode(200)
  startJob(@AuthUser() user: User, @Body() dto: StartAiJobDto) {
    return this.jobs.start(user, dto);
  }
  @UseGuards(JwtAuthGuard)
  @Post('jobs/list')
  @HttpCode(200)
  listJobs(@AuthUser() user: User, @Body() dto: AiJobsDto) {
    return this.jobs.list(user, dto.pageId, dto.jobId);
  }
  @UseGuards(JwtAuthGuard)
  @Post('status')
  @HttpCode(200)
  status(@AuthUser() user: User, @Req() request: FastifyRequest) {
    return this.ai.status(user, request.headers.origin, request.headers.host);
  }
  @UseGuards(JwtAuthGuard)
  @Post('sign-in')
  @HttpCode(200)
  signIn(
    @AuthUser() user: User,
    @Body() dto: ProfileAiDto,
    @Req() request: FastifyRequest,
  ) {
    return this.ai.signIn(
      user,
      dto.profileId,
      request.headers.origin,
      request.headers.host,
    );
  }
  @UseGuards(JwtAuthGuard)
  @Post('models')
  @HttpCode(200)
  models(@AuthUser() user: User) {
    return this.ai.models(user);
  }
  @UseGuards(JwtAuthGuard)
  @Post('settings')
  @HttpCode(200)
  settings(@AuthUser() user: User, @Body() dto: SettingsAiDto) {
    return this.ai.settings(user, dto.profileId, dto.model);
  }
  @UseGuards(JwtAuthGuard)
  @Post('disconnect')
  @HttpCode(200)
  disconnect(@AuthUser() user: User, @Body() dto: SettingsAiDto) {
    return this.ai.disconnect(user, dto.profileId);
  }
  @UseGuards(JwtAuthGuard)
  @Post('prepare')
  @HttpCode(200)
  prepare(@AuthUser() user: User, @Body() dto: PrepareAiDto) {
    return this.ai.prepare(user, dto);
  }
  @UseGuards(JwtAuthGuard)
  @Post('execute')
  @HttpCode(200)
  execute(@AuthUser() user: User, @Body() dto: ExecuteAiDto) {
    return this.ai.execute(user, dto.id, dto.approved);
  }

  // OAuth state binds this public loopback callback to the authenticated initiator.
  @Get('callback')
  async callback(
    @Query() query: Record<string, string>,
    @Res() reply: FastifyReply,
    @Req() request: FastifyRequest,
  ) {
    const messages = aiCallbackMessages(this.ai.callbackLocale(query.state));
    let message = messages.connected;
    let status = 200;
    try {
      requireLocalAiCallback(
        this.ai.callbackUrlForState(query.state),
        request.headers.host,
      );
      await this.ai.callback(query);
    } catch (error) {
      const code = (error as { getResponse?: () => unknown })?.getResponse?.();
      message =
        typeof code === 'object' &&
        code !== null &&
        'code' in code &&
        code.code === 'oauthCancelled'
          ? messages.canceled
          : messages.error;
      status = 400;
    }
    message = message.replace(
      /[&<>"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[char],
    );
    reply
      .header('Cache-Control', 'no-store')
      .header('Referrer-Policy', 'no-referrer')
      .header(
        'Content-Security-Policy',
        "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
      );
    return reply
      .code(status)
      .type('text/html')
      .send(
        `<!doctype html><html lang="${messages.language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${messages.title}</title><body style="font-family:system-ui;padding:32px;max-width:640px"><h1>${messages.title}</h1><p>${message}</p><p>${messages.close}</p></body></html>`,
      );
  }
}
