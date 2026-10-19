import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Post,
  Req,
  Res,
  UseGuards,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';
import {
  ALL_NAMED_THROTTLERS_SKIPPED,
  MCP_THROTTLER,
} from '../throttle/throttler-names';
import type { User, Workspace } from '@docmost/db/types/entity.types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequireSessionAuth } from '../../common/decorators/require-session-auth.decorator';
import {
  AuthAccountUser,
  AuthAccountWorkspace,
} from '../../common/decorators/auth-account.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { McpContext, McpTokenService } from './mcp-token.service';
import { McpToolsService } from './mcp-tools.service';
import { createNopetionMcp } from './mcp-server';

export class CreateMcpTokenDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name: string;
  @IsIn(['read', 'write']) access: 'read' | 'write';
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  spaceIds: string[];
  @IsInt() @Min(1) @Max(90) expiresInDays: number;
}
export class RevokeMcpTokenDto {
  @IsUUID() id: string;
}

@Injectable()
export class McpBearerGuard implements CanActivate {
  constructor(private readonly tokens: McpTokenService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest(),
      res = context.switchToHttp().getResponse();
    res.header('Cache-Control', 'no-store');
    this.tokens.assertOrigin(req.headers.origin);
    try {
      req.mcpContext = await this.tokens.authenticate(
        req.headers.authorization,
      );
    } catch (error) {
      res.header('WWW-Authenticate', 'Bearer realm="Nopetion MCP"');
      throw error;
    }
    return true;
  }
}

@Controller('personal-mcp')
@UseGuards(ThrottlerGuard, JwtAuthGuard)
@SkipThrottle({ ...ALL_NAMED_THROTTLERS_SKIPPED, [MCP_THROTTLER]: false })
@RequireSessionAuth()
export class PersonalMcpSettingsController {
  constructor(private readonly tokens: McpTokenService) {}
  @Post('status')
  @HttpCode(200)
  status(
    @AuthAccountUser() owner: User,
    @AuthAccountWorkspace() root: Workspace,
    @AuthWorkspace() target: Workspace,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    this.tokens.assertOrigin(req.headers.origin);
    res.header('Cache-Control', 'no-store');
    return this.tokens.list(owner, root, target);
  }
  @Post('create')
  @HttpCode(200)
  create(
    @AuthAccountUser() owner: User,
    @AuthAccountWorkspace() root: Workspace,
    @AuthWorkspace() target: Workspace,
    @Body() dto: CreateMcpTokenDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    this.tokens.assertOrigin(req.headers.origin);
    res.header('Cache-Control', 'no-store');
    return this.tokens.create(owner, root, target, dto);
  }
  @Post('revoke')
  @HttpCode(200)
  revoke(
    @AuthAccountUser() owner: User,
    @AuthAccountWorkspace() root: Workspace,
    @AuthWorkspace() target: Workspace,
    @Body() dto: RevokeMcpTokenDto,
    @Req() req: FastifyRequest,
  ) {
    this.tokens.assertOrigin(req.headers.origin);
    return this.tokens.revoke(owner, root, target, dto.id);
  }
}

@Controller('mcp')
@UseGuards(ThrottlerGuard, McpBearerGuard)
@SkipThrottle({ ...ALL_NAMED_THROTTLERS_SKIPPED, [MCP_THROTTLER]: false })
export class PersonalMcpController {
  constructor(private readonly tools: McpToolsService) {}
  @Post()
  @SkipTransform()
  async handle(
    @Req() req: FastifyRequest & { mcpContext: McpContext },
    @Res() reply: FastifyReply,
  ) {
    const server = createNopetionMcp(req.mcpContext, this.tools);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    // The SDK owns the raw HTTP response; do not wrap JSON-RPC in the app envelope.
    reply.raw.setHeader('Cache-Control', 'no-store');
    reply.hijack();
    try {
      await server.connect(transport);
      await transport.handleRequest(req.raw, reply.raw, req.body);
    } finally {
      await transport.close();
      await server.close();
    }
  }
  @Get()
  @SkipTransform()
  unsupported(@Res() reply: FastifyReply) {
    return reply
      .code(405)
      .header('Allow', 'POST')
      .send({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message:
            'Use Streamable HTTP POST; standalone SSE and sessions are not used',
        },
        id: null,
      });
  }
  @Delete()
  @SkipTransform()
  endSession(@Res() reply: FastifyReply) {
    return this.unsupported(reply);
  }
}
