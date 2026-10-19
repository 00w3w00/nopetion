import { Global, Module } from '@nestjs/common';
import { PersonalWorkspaceAccessModule } from '../personal-workspace/personal-workspace-access.module';
import { RealtimeSessionAccess } from './realtime-session-access';

@Global()
@Module({
  imports: [PersonalWorkspaceAccessModule],
  providers: [RealtimeSessionAccess],
  exports: [RealtimeSessionAccess],
})
export class RealtimeSessionAccessModule {}
