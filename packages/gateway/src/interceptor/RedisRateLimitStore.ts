import Redis from 'ioredis';
import { RateLimitStore } from '@openfamily/policy-engine';

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly redis: Redis) {}

  async incrementAndCheck(
    key: string,
    windowSeconds: number,
    maxCalls: number
  ): Promise<{ allowed: boolean; count: number }> {
    // Use a Lua script for atomic increment + TTL set
    const script = `
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      return count
    `;

    const count = (await this.redis.eval(script, 1, key, String(windowSeconds))) as number;
    return { allowed: count <= maxCalls, count };
  }
}
