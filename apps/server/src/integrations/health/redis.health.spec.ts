import { RedisHealthIndicator } from './redis.health';
import { Redis } from 'ioredis';

jest.mock('ioredis', () => ({ Redis: jest.fn() }));

describe('Redis health probes', () => {
  const up = jest.fn(() => ({ redis: { status: 'up' } }));
  const down = jest.fn(() => ({ redis: { status: 'down' } }));
  const client = { on: jest.fn(), connect: jest.fn(), ping: jest.fn(), disconnect: jest.fn() };
  const indicator = new RedisHealthIndicator(
    { check: () => ({ up, down }) } as any,
    { getRedisUrl: () => 'redis://127.0.0.1:6379' } as any,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    client.connect.mockResolvedValue(undefined);
    client.ping.mockResolvedValue('PONG');
    (Redis as unknown as jest.Mock).mockImplementation(() => client);
  });
  it('closes a successful connection', async () => {
    expect(await indicator.pingCheck('redis')).toEqual({ redis: { status: 'up' } });
    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(Redis).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      lazyConnect: true, connectTimeout: 1500, commandTimeout: 1500, maxRetriesPerRequest: 0,
    }));
    const options = (Redis as unknown as jest.Mock).mock.calls[0][1];
    expect(options.retryStrategy(1)).toBeNull();
  });
  it.each(['connect', 'ping'] as const)('closes the connection when %s rejects', async step => {
    client[step].mockRejectedValueOnce(new Error('isolated failure'));
    expect(await indicator.pingCheck('redis')).toEqual({ redis: { status: 'down' } });
    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });
});
