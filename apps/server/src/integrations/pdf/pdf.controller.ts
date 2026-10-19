import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { User } from '@docmost/db/types/entity.types';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequireSessionAuth } from '../../common/decorators/require-session-auth.decorator';
import { sanitizeFileName } from '../../common/helpers';
import { ExportPdfDto, PdfTreeDto } from './pdf.dto';
import { PdfService } from './pdf.service';
import { AUDIT_SERVICE, type IAuditService } from '../audit/audit.service';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';

@Controller('pdf-export')
@RequireSessionAuth()
@UseGuards(JwtAuthGuard)
export class PdfController {
  constructor(
    private pdf: PdfService,
    @Inject(AUDIT_SERVICE) private audit: IAuditService,
  ) {}
  @Post('tree')
  @HttpCode(200)
  async tree(@AuthUser() user: User, @Body() dto: PdfTreeDto) {
    return this.pdf.tree(user, dto.pageId);
  }
  @Post()
  @HttpCode(200)
  async export(
    @AuthUser() user: User,
    @Body() dto: ExportPdfDto,
    @Res() reply: FastifyReply,
  ) {
    const { title, buffer } = await this.pdf.export(user, dto);
    this.audit.log({
      event: AuditEvent.PAGE_EXPORTED,
      resourceType: AuditResource.PAGE,
      resourceId: dto.pageId,
      metadata: {
        title,
        format: 'pdf',
        includeChildren: !!dto.selectedPages?.length,
        documentCount: 1 + (dto.selectedPages?.length || 0),
        includeAttachments: false,
      },
    });
    const filename = encodeURIComponent(
      sanitizeFileName(title, { preserveSpaces: true }).slice(0, 160) + '.pdf',
    );
    return reply
      .headers({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${filename}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(buffer);
  }
}
