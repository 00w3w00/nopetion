import { DynamicModule, Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Global()
@Module({})
export class MailModule {
  static forRootAsync(options: { imports?: any[] }): DynamicModule {
    return { module: MailModule, imports: options.imports || [], providers: [MailService], exports: [MailService] };
  }
}
