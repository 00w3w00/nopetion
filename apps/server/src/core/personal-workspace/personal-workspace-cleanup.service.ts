import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import type { KyselyDB } from '@docmost/db/types/kysely.types';
import { StorageService } from '../../integrations/storage/storage.service';

@Injectable()
export class PersonalWorkspaceCleanup implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval>;
  private readonly logger = new Logger(PersonalWorkspaceCleanup.name);
  constructor(@InjectKysely() private readonly db: KyselyDB, private readonly storage: StorageService) {}

  onModuleInit() {
    this.timer = setInterval(() => { void this.drain().catch(() => this.logger.warn('Reset attachment cleanup will retry')); }, 60000);
    this.timer.unref();
  }
  onModuleDestroy() { clearInterval(this.timer); }

  async drain(ownerId?: string) {
    let query = this.db.selectFrom('personalWorkspaceResetFiles').selectAll().orderBy('createdAt').limit(100);
    if (ownerId) query = query.where('ownerId', '=', ownerId);
    const files = await query.execute();
    for (let i = 0; i < files.length; i += 8) {
      await Promise.all(files.slice(i, i + 8).map(async file => {
        try {
          await this.storage.delete(file.filePath);
          await this.db.deleteFrom('personalWorkspaceResetFiles').where('id', '=', file.id).execute();
        } catch { this.logger.warn('Reset attachment cleanup pending; original account and AI storage remain intact'); }
      }));
    }
    let remaining = this.db.selectFrom('personalWorkspaceResetFiles').select(eb => eb.fn.countAll<number>().as('count'));
    if (ownerId) remaining = remaining.where('ownerId', '=', ownerId);
    return Number((await remaining.executeTakeFirst()).count);
  }
}
