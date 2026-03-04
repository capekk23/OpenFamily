import { describe, it, expect } from 'vitest';
import { BlockedToolsRule } from '../BlockedToolsRule.js';
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

const rule = new BlockedToolsRule();

describe('BlockedToolsRule', () => {
  it('returns null when blockedTools is empty', () => {
    const result = rule.evaluate(baseCtx());
    expect(result.verdict).toBeNull();
  });

  it('returns null when tool is not in blockedTools', () => {
    const ctx = {
      ...baseCtx(),
      policy: { ...baseCtx().policy, blockedTools: ['send_email'] },
    };
    expect(rule.evaluate(ctx).verdict).toBeNull();
  });

  it('returns BLOCK when tool is in blockedTools', () => {
    const ctx = {
      ...baseCtx(),
      policy: { ...baseCtx().policy, blockedTools: ['web_search'] },
    };
    const result = rule.evaluate(ctx);
    expect(result.verdict).toBe('BLOCK');
    expect(result.reason).toContain('web_search');
  });

  it('blocks regardless of allowedTools', () => {
    const ctx = {
      ...baseCtx(),
      policy: {
        ...baseCtx().policy,
        allowedTools: ['web_search'],
        blockedTools: ['web_search'],
      },
    };
    expect(rule.evaluate(ctx).verdict).toBe('BLOCK');
  });
});
