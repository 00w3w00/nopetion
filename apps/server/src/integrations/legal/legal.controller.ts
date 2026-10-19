import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { FastifyReply } from 'fastify';
import { EnvironmentService } from '../environment/environment.service';

@Controller('legal')
export class LegalController {
  constructor(private readonly environment: EnvironmentService) {}
  // Fixed build artifacts only. Never serve a checkout, environment or user
  // storage directory, and never construct a path from request parameters.
  private readonly root = join(__dirname, '../../../../../');

  @Get()
  async notice(@Res() reply: FastifyReply) {
    const base = new URL(this.environment.getAppUrl()).pathname.replace(/\/+$/, '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return reply.type('text/html; charset=utf-8').header('Cache-Control', 'no-store').send(
      '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nopetion source and license</title>' +
      '<h1>Nopetion source and license</h1><p>Nopetion is a modified Docmost 0.96.0 fork. Core copyright belongs to the original Docmost contributors and subsequent contributors. The core is licensed under AGPL-3.0; third-party code and fonts retain their own licenses.</p>' +
      `<p><a href="${base}/api/legal/source">Download corresponding application source</a> · <a href="${base}/api/legal/license">Read AGPL-3.0</a></p>` +
      '<p>The source archive contains original attribution, modification dates, third-party notices and build instructions. Removed Enterprise implementations are excluded; their separate license notices remain. No warranty is provided. This is not an official Docmost release.</p></html>',
    );
  }

  @Get('source')
  async source(@Res() reply: FastifyReply) {
    const file = join(this.root, 'notices/corresponding-source.tar.gz');
    try { await access(file); }
    catch { throw new NotFoundException('Source archive unavailable. Build the deployment image from its complete source tree.'); }
    return reply.type('application/gzip').header('Content-Disposition', 'attachment; filename="nopetion-source.tar.gz"')
      .header('Cache-Control', 'no-store').send(createReadStream(file));
  }

  @Get('license')
  async license(@Res() reply: FastifyReply) {
    return reply.type('text/plain; charset=utf-8').send(createReadStream(join(this.root, 'LICENSE')));
  }
}
