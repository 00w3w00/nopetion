import { Module } from '@nestjs/common';
import { AiCredentialsStore } from './ai-credentials.store';
import { AI_PROVIDER, OpenAiOAuthProvider } from './openai-oauth.provider';
import { PersonalAiController } from './personal-ai.controller';
import { PersonalAiService } from './personal-ai.service';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from '../queue/constants';
import { CollaborationModule } from '../../collaboration/collaboration.module';
import { PersonalWorkspaceAccessModule } from '../../core/personal-workspace/personal-workspace-access.module';
import { PersonalAiJobsService } from './personal-ai-jobs.service';
import { PersonalAiJobsProcessor } from './personal-ai-jobs.processor';
import { NotificationModule } from '../../core/notification/notification.module';
import { PersonalAiNotificationsService } from './personal-ai-notifications.service';

@Module({
  imports: [CollaborationModule, PersonalWorkspaceAccessModule, NotificationModule,
    BullModule.registerQueue({ name: QueueName.PERSONAL_AI_QUEUE })],
  controllers: [PersonalAiController],
  providers: [
    AiCredentialsStore,
    PersonalAiService,
    PersonalAiJobsService,
    PersonalAiJobsProcessor,
    PersonalAiNotificationsService,
    { provide: AI_PROVIDER, useClass: OpenAiOAuthProvider },
  ],
})
export class PersonalAiModule {}
