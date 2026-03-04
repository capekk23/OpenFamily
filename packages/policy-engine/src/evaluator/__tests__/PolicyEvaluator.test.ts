import { describe, it, expect, vi } from 'vitest';
import { PolicyEvaluator } from '../PolicyEvaluator.js';
import { EvaluationContext, RateLimitStore } from '../../types.js';

const allowingStore: RateLimitStore = {
  incrementAndCheck: vi.fn().mockResolvedValue({ allowed: true, count: 1 }),
};

const baseCtx = (): EvaluationContext => ({
  sessionId: 'sess-1',
  agentId: 'agent-1',
  toolName: 'web_search',
  toolInput: {},
  spentBudget: 0,
  policy: {
    blockedTools: [],
    allowedDomains: [],
    useSupervisor: false,
  },
});

describe('PolicyEvaluator', () => {
  it('returns APPROVE when no restrictive rules', async () => {
    const evaluator = new PolicyEvaluator(allowingStore);
    const result = await evaluator.evaluate(baseCtx());
    expect(result.verdict).toBe('APPROVE');
  });

  it('BLOCK from BlockedToolsRule overrides APPROVE', async () => {
    const evaluator = new PolicyEvaluator(allowingStore);
    const ctx = {
      ...baseCtx(),
      policy: { ...baseCtx().policy, blockedTools: ['web_search'] },
    };
    const result = await evaluator.evaluate(ctx);
    expect(result.verdict).toBe('BLOCK');
    expect(result.ruleName).toBe('BlockedToolsRule');
  });

  it('BLOCK from AllowedToolsRule fires when tool not in allowlist', async () => {
    const evaluator = new PolicyEvaluator(allowingStore);
    const ctx = {
      ...baseCtx(),
      policy: { ...baseCtx().policy, allowedTools: ['file_read'] },
    };
    const result = await evaluator.evaluate(ctx);
    expect(result.verdict).toBe('BLOCK');
    expect(result.ruleName).toBe('AllowedToolsRule');
  });

  it('BLOCK takes precedence over HUMAN_APPROVAL', async () => {
    const evaluator = new PolicyEvaluator(allowingStore);
    const ctx = {
      ...baseCtx(),
      policy: {
        ...baseCtx().policy,
        blockedTools: ['web_search'],
        requireApproval: {
          always: true,
          forTools: [],
          approvalTimeoutSeconds: 300,
          timeoutBehavior: 'deny' as const,
        },
      },
    };
    const result = await evaluator.evaluate(ctx);
    expect(result.verdict).toBe('BLOCK');
  });

  it('HUMAN_APPROVAL takes precedence over SUPERVISOR', async () => {
    const evaluator = new PolicyEvaluator(allowingStore);
    const ctx = {
      ...baseCtx(),
      policy: {
        ...baseCtx().policy,
        useSupervisor: true,
        requireApproval: {
          always: true,
          forTools: [],
          approvalTimeoutSeconds: 300,
          timeoutBehavior: 'deny' as const,
        },
      },
    };
    const result = await evaluator.evaluate(ctx);
    expect(result.verdict).toBe('HUMAN_APPROVAL');
  });

  it('SUPERVISOR verdict returned when useSupervisor=true', async () => {
    const evaluator = new PolicyEvaluator(allowingStore);
    const ctx = {
      ...baseCtx(),
      policy: { ...baseCtx().policy, useSupervisor: true },
    };
    const result = await evaluator.evaluate(ctx);
    expect(result.verdict).toBe('SUPERVISOR');
  });

  it('stops early on BLOCK without evaluating remaining rules', async () => {
    const store: RateLimitStore = {
      incrementAndCheck: vi.fn(),
    };
    const evaluator = new PolicyEvaluator(store);
    const ctx = {
      ...baseCtx(),
      policy: {
        ...baseCtx().policy,
        blockedTools: ['web_search'],
        rateLimits: { callsPerMinute: 10, callsPerHour: 100 },
      },
    };
    await evaluator.evaluate(ctx);
    // RateLimitRule should never be called because BLOCK fires early
    expect(store.incrementAndCheck).not.toHaveBeenCalled();
  });

  it('returns reason from winning rule', async () => {
    const evaluator = new PolicyEvaluator(allowingStore);
    const ctx = {
      ...baseCtx(),
      policy: { ...baseCtx().policy, blockedTools: ['web_search'] },
    };
    const result = await evaluator.evaluate(ctx);
    expect(result.reason).toContain('web_search');
  });
});
