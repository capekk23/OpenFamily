import { describe, it, expect, vi } from 'vitest';
import { RateLimitRule } from '../RateLimitRule.js';
import { EvaluationContext, RateLimitStore } from '../../../types.js';

const basePolicy = {
  blockedTools: [],
  allowedDomains: [],
  useSupervisor: false,
};

const baseCtx = (): EvaluationContext => ({
  sessionId: 'sess-1',
  agentId: 'agent-1',
  toolName: 'web_search',
  toolInput: {},
  spentBudget: 0,
  policy: basePolicy,
});

function makeStore(allowed: boolean, count = 1): RateLimitStore {
  return {
    incrementAndCheck: vi.fn().mockResolvedValue({ allowed, count }),
  };
}

describe('RateLimitRule', () => {
  it('returns null when no rateLimits configured', async () => {
    const store = makeStore(true);
    const rule = new RateLimitRule(store);
    const result = await rule.evaluate(baseCtx());
    expect(result.verdict).toBeNull();
    expect(store.incrementAndCheck).not.toHaveBeenCalled();
  });

  it('returns null when within both rate limits', async () => {
    const store = makeStore(true, 1);
    const rule = new RateLimitRule(store);
    const ctx = {
      ...baseCtx(),
      policy: {
        ...basePolicy,
        rateLimits: { callsPerMinute: 10, callsPerHour: 100 },
      },
    };
    expect((await rule.evaluate(ctx)).verdict).toBeNull();
    expect(store.incrementAndCheck).toHaveBeenCalledTimes(2);
  });

  it('blocks when per-minute limit exceeded', async () => {
    const store: RateLimitStore = {
      incrementAndCheck: vi
        .fn()
        .mockResolvedValueOnce({ allowed: false, count: 11 })
        .mockResolvedValueOnce({ allowed: true, count: 5 }),
    };
    const rule = new RateLimitRule(store);
    const ctx = {
      ...baseCtx(),
      policy: {
        ...basePolicy,
        rateLimits: { callsPerMinute: 10, callsPerHour: 100 },
      },
    };
    const result = await rule.evaluate(ctx);
    expect(result.verdict).toBe('BLOCK');
    expect(result.reason).toContain('minute');
  });

  it('blocks when per-hour limit exceeded', async () => {
    const store: RateLimitStore = {
      incrementAndCheck: vi
        .fn()
        .mockResolvedValueOnce({ allowed: true, count: 5 })
        .mockResolvedValueOnce({ allowed: false, count: 101 }),
    };
    const rule = new RateLimitRule(store);
    const ctx = {
      ...baseCtx(),
      policy: {
        ...basePolicy,
        rateLimits: { callsPerMinute: 10, callsPerHour: 100 },
      },
    };
    const result = await rule.evaluate(ctx);
    expect(result.verdict).toBe('BLOCK');
    expect(result.reason).toContain('hour');
  });

  it('uses correct Redis key pattern per session', async () => {
    const store = makeStore(true);
    const rule = new RateLimitRule(store);
    const ctx = {
      ...baseCtx(),
      sessionId: 'unique-session-xyz',
      policy: {
        ...basePolicy,
        rateLimits: { callsPerMinute: 10, callsPerHour: 100 },
      },
    };
    await rule.evaluate(ctx);
    const calls = (store.incrementAndCheck as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toContain('unique-session-xyz');
    expect(calls[0][0]).toContain('minute');
    expect(calls[1][0]).toContain('hour');
  });
});
