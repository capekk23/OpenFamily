import { describe, it, expect } from 'vitest';
import { BudgetCapRule } from '../BudgetCapRule.js';
import { EvaluationContext } from '../../../types.js';

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
  estimatedCost: 0,
  policy: basePolicy,
});

const rule = new BudgetCapRule();

describe('BudgetCapRule', () => {
  it('returns null when no budgetCap configured', () => {
    expect(rule.evaluate(baseCtx()).verdict).toBeNull();
  });

  it('returns null when within per-call cap', () => {
    const ctx = {
      ...baseCtx(),
      estimatedCost: 0.01,
      policy: { ...basePolicy, budgetCap: { maxPerCall: 0.05, maxPerSession: 10 } },
    };
    expect(rule.evaluate(ctx).verdict).toBeNull();
  });

  it('blocks when estimated cost exceeds per-call cap', () => {
    const ctx = {
      ...baseCtx(),
      estimatedCost: 0.10,
      policy: { ...basePolicy, budgetCap: { maxPerCall: 0.05, maxPerSession: 10 } },
    };
    const result = rule.evaluate(ctx);
    expect(result.verdict).toBe('BLOCK');
    expect(result.reason).toContain('per-call cap');
  });

  it('blocks when projected total exceeds session cap', () => {
    const ctx = {
      ...baseCtx(),
      spentBudget: 9,
      estimatedCost: 2,
      policy: { ...basePolicy, budgetCap: { maxPerCall: 5, maxPerSession: 10 } },
    };
    const result = rule.evaluate(ctx);
    expect(result.verdict).toBe('BLOCK');
    expect(result.reason).toContain('session cap');
  });

  it('returns null exactly at session cap boundary', () => {
    const ctx = {
      ...baseCtx(),
      spentBudget: 8,
      estimatedCost: 2,
      policy: { ...basePolicy, budgetCap: { maxPerCall: 5, maxPerSession: 10 } },
    };
    expect(rule.evaluate(ctx).verdict).toBeNull();
  });

  it('triggers HUMAN_APPROVAL when whenBudgetExceeds threshold crossed', () => {
    const ctx = {
      ...baseCtx(),
      spentBudget: 4,
      estimatedCost: 1,
      policy: {
        ...basePolicy,
        budgetCap: { maxPerCall: 5, maxPerSession: 20 },
        requireApproval: {
          always: false,
          forTools: [],
          whenBudgetExceeds: 4.5,
          approvalTimeoutSeconds: 300,
          timeoutBehavior: 'deny' as const,
        },
      },
    };
    const result = rule.evaluate(ctx);
    expect(result.verdict).toBe('HUMAN_APPROVAL');
  });

  it('treats undefined estimatedCost as 0', () => {
    const ctx = {
      ...baseCtx(),
      estimatedCost: undefined,
      policy: { ...basePolicy, budgetCap: { maxPerCall: 0.05, maxPerSession: 10 } },
    };
    expect(rule.evaluate(ctx).verdict).toBeNull();
  });

  it('blocks when zero budgetCap and nonzero cost', () => {
    const ctx = {
      ...baseCtx(),
      estimatedCost: 0.001,
      policy: { ...basePolicy, budgetCap: { maxPerCall: 0, maxPerSession: 0 } },
    };
    expect(rule.evaluate(ctx).verdict).toBe('BLOCK');
  });
});
