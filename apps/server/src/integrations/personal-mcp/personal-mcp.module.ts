import { Module } from '@nestjs/common';
import { PageModule } from '../../core/page/page.module';
import { SearchModule } from '../../core/search/search.module';
import { CollaborationModule } from '../../collaboration/collaboration.module';
import { McpTokenService } from './mcp-token.service';
import { McpToolsService } from './mcp-tools.service';
import {
  McpBearerGuard,
  PersonalMcpController,
  PersonalMcpSettingsController,
} from './personal-mcp.controller';

@Module({
  imports: [PageModule, SearchModule, CollaborationModule],
  providers: [McpTokenService, McpToolsService, McpBearerGuard],
  controllers: [PersonalMcpController, PersonalMcpSettingsController],
})
export class PersonalMcpModule {}
