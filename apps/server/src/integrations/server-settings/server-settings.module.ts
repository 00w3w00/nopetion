import { Global, Module } from '@nestjs/common';
import { PersonalWorkspaceAccessModule } from '../../core/personal-workspace/personal-workspace-access.module';
import { ServerSettingsService } from './server-settings.service';
import { ServerSettingsController } from './server-settings.controller';
@Global()
@Module({
  imports: [PersonalWorkspaceAccessModule],
  providers: [ServerSettingsService],
  controllers: [ServerSettingsController],
  exports: [ServerSettingsService],
})
export class ServerSettingsModule {}
