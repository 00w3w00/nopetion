import { Global, Module } from '@nestjs/common';
import { WorkspaceModule } from '../workspace/workspace.module';
import { PersonalWorkspaceAccessModule } from './personal-workspace-access.module';
import { PersonalWorkspaceService } from './personal-workspace.service';
import { PersonalWorkspaceController } from './personal-workspace.controller';
import { PersonalWorkspaceReset } from './personal-workspace-reset.service';
import { PersonalWorkspaceCleanup } from './personal-workspace-cleanup.service';
import { SpaceModule } from '../space/space.module';

@Global()
@Module({ imports: [WorkspaceModule, SpaceModule, PersonalWorkspaceAccessModule],
  providers: [PersonalWorkspaceService, PersonalWorkspaceReset, PersonalWorkspaceCleanup],
  controllers: [PersonalWorkspaceController] })
export class PersonalWorkspaceModule {}
