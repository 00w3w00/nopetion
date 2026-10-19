import { Module, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { join } from 'path';
import * as fs from 'node:fs';
import fastifyStatic from '@fastify/static';
import { ServerSettingsService } from '../server-settings/server-settings.service';
import { EnvironmentService } from '../environment/environment.service';

@Module({})
export class StaticModule implements OnModuleInit {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly environmentService: EnvironmentService,
    private readonly serverSettings: ServerSettingsService,
  ) {}

  public async onModuleInit() {
    const httpAdapter = this.httpAdapterHost.httpAdapter;
    const app = httpAdapter.getInstance();

    const clientDistPath = join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'client/dist',
    );

    const indexFilePath = join(clientDistPath, 'index.html');

    if (fs.existsSync(clientDistPath) && fs.existsSync(indexFilePath)) {
      const indexTemplateFilePath = join(clientDistPath, 'index-template.html');
      const windowVar = '<!--window-config-->';

      const configString = {
        PERSONAL_MODE: this.environmentService.isPersonalMode(),
        ENV: this.environmentService.getNodeEnv(),
        APP_URL: this.environmentService.getAppUrl(),
        CLOUD: this.environmentService.isCloud(),
        FILE_UPLOAD_SIZE_LIMIT:
          this.environmentService.getFileUploadSizeLimit(),
        FILE_IMPORT_SIZE_LIMIT:
          this.environmentService.getFileImportSizeLimit(),

        SUBDOMAIN_HOST: this.environmentService.isCloud()
          ? this.environmentService.getSubdomainHost()
          : undefined,
        COLLAB_URL: this.environmentService.getCollabUrl(),
        BILLING_TRIAL_DAYS: this.environmentService.isCloud()
          ? this.environmentService.getBillingTrialDays()
          : undefined,
        BETA_PUBLIC_SPACES: this.environmentService.isBetaPublicSpaces(),
        POSTHOG_HOST: this.environmentService.getPostHogHost(),
        POSTHOG_KEY: this.environmentService.getPostHogKey(),
        AI_VECTOR_DRIVER:
          this.environmentService.getAiVectorDriver() === 'turbopuffer'
            ? 'turbopuffer'
            : undefined,
      };

      const html = fs.readFileSync(fs.existsSync(indexTemplateFilePath) ? indexTemplateFilePath : indexFilePath, 'utf8');
      const renderIndex = async (_req: any, res: any) => {
        const settings = await this.serverSettings.snapshot();
        const config = { ...configString, DRAWIO_URL: settings.drawioUrl };
        const json = JSON.stringify(config).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
        return res.header('Cache-Control', 'no-cache, no-store, must-revalidate').type('text/html')
          .send(html.replace(windowVar, `<script>window.CONFIG=${json};</script>`));
      };

      const RENDER_PATH = '*';

      await app.register(fastifyStatic, {
        root: clientDistPath,
        wildcard: false,
        index: false,
        globIgnore: ['**/index.html', '**/index-template.html'],
        setHeaders: (reply: any, pathName: string) => {
          // Vite content-hashes everything under /assets, so they can be cached forever
          if (/[\\/]assets[\\/]/.test(pathName)) {
            reply.header(
              'Cache-Control',
              'public, max-age=31536000, immutable',
            );
          }
        },
      });

      app.get('/', renderIndex);
      app.get('/index.html', renderIndex);
      app.get(RENDER_PATH, renderIndex);
    }
  }
}
