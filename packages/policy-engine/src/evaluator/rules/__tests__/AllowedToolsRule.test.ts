import { describe, it, expect } from 'vitest';
import { AllowedToolsRule } from '../AllowedToolsRule.js';
import { EvaluationContext } from '../../../types.js';

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

const rule = new AllowedToolsRule();

describe('AllowedToolsRule', () => {
  it('returns null when no allowedTools configured', () => {
    const result = rule.evaluate(baseCtx());
    expect(result.verdict).toBeNull();
  });

  it('returns null when allowedTools is empty array', () => {
    const ctx = { ...baseCtx(), policy: { ...baseCtx().policy, allowedTools: [] } };
    const result = rule.evaluate(ctx);
    expect(result.verdict).toBeNull();
  });

  it('returns null when tool is in allowedTools', () => {
    const ctx = {
      ...baseCtx(),
      policy: { ...baseCtx().policy, allowedTools: ['web_search', 'file_read'] },
    };
    const result = rule.evaluate(ctx);
    expect(result.verdict).toBeNull();
  });

  it('returns BLOCK when tool is not in allowedTools', () => {
    const ctx = {
      ...baseCtx(),
      policy: { ...baseCtx().policy, allowedTools: ['file_read'] },
    };
    const result = rule.evaluate(ctx);
    expect(result.verdict).toBe('BLOCK');
    expect(result.reason).toContain('web_search');
  });

  it('is case-sensitive for tool names', () => {
    const ctx = {
      ...baseCtx(),
      policy: { ...baseCtx().policy, allowedTools: ['Web_Search'] },
    };
    const result = rule.evaluate(ctx);
    expect(result.verdict).toBe('BLOCK');
  });
});
