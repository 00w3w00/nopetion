import { Global, Module } from '@nestjs/common';
import { PersonalWorkspaceAccess } from './personal-workspace-access.service';

// Also available to the standalone collaboration process, without creation services.
@Global()
@Module({ providers: [PersonalWorkspaceAccess], exports: [PersonalWorkspaceAccess] })
export class PersonalWorkspaceAccessModule {}
