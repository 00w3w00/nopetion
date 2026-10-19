import { OnModuleDestroy } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { QueueName } from '../queue/constants';
import { PersonalAiJobsService } from './personal-ai-jobs.service';

@Processor(QueueName.PERSONAL_AI_QUEUE, { concurrency: 2 })
export class PersonalAiJobsProcessor extends WorkerHost implements OnModuleDestroy {
  constructor(private readonly jobs: PersonalAiJobsService) { super(); }
  async process(job: Job<{ id: string }>) { await this.jobs.process(job.data.id); }
  async onModuleDestroy() { await this.worker.close(); }
}
