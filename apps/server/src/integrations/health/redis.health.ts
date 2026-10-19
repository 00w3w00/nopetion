import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { Injectable, Logger } from '@nestjs/common';
import { EnvironmentService } from '../environment/environment.service';
import { Redis } from 'ioredis';
import { parseRedisUrl } from '../../common/helpers';

@Injectable()
export class RedisHealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private environmentService: EnvironmentService,
  ) {}

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    let redis: Redis | undefined;

    try {
      const redisUrl = this.environmentService.getRedisUrl();
      redis = new Redis(redisUrl, {
        lazyConnect: true,
        connectTimeout: 1500,
        commandTimeout: 1500,
        maxRetriesPerRequest: 0,
        retryStrategy: () => null,
        tls: parseRedisUrl(redisUrl).tls,
      });
      // Report the failed probe once below, rather than ioredis' unhandled event.
      redis.on('error', () => {});
      await redis.connect();
      await redis.ping();
      return indicator.up();
    } catch (e) {
      this.logger.error(e);
      return indicator.down(`${key} is not available`);
    } finally {
      redis?.disconnect();
    }
  }
}
