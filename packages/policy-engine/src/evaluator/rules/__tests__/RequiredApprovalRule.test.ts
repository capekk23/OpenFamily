import { describe, it, expect } from 'vitest';
import { RequiredApprovalRule } from '../RequiredApprovalRule.js';
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
  policy: basePolicy,
});

const rule = new RequiredApprovalRule();

describe('RequiredApprovalRule', () => {
  it('returns null when no requireApproval and no supervisor', () => {
    expect(rule.evaluate(baseCtx()).verdict).toBeNull();
  });

  it('returns SUPERVISOR when useSupervisor=true and no requireApproval', () => {
    const ctx = { ...baseCtx(), policy: { ...basePolicy, useSupervisor: true } };
    expect(rule.evaluate(ctx).verdict).toBe('SUPERVISOR');
  });

  it('returns HUMAN_APPROVAL when always=true', () => {
    const ctx = {
      ...baseCtx(),
      policy: {
        ...basePolicy,
        requireApproval: {
          always: true,
          forTools: [],
          approvalTimeoutSeconds: 300,
          timeoutBehavior: 'deny' as const,
        },
      },
    };
    expect(rule.evaluate(ctx).verdict).toBe('HUMAN_APPROVAL');
  });

  it('returns HUMAN_APPROVAL when tool is in forTools', () => {
    const ctx = {
      ...baseCtx(),
      toolName: 'send_email',
      policy: {
        ...basePolicy,
        requireApproval: {
          always: false,
          forTools: ['send_email', 'delete_file'],
          approvalTimeoutSeconds: 300,
          timeoutBehavior: 'deny' as const,
        },
      },
    };
    expect(rule.evaluate(ctx).verdict).toBe('HUMAN_APPROVAL');
  });

  it('returns SUPERVISOR when tool not in forTools but useSupervisor=true', () => {
    const ctx = {
      ...baseCtx(),
      toolName: 'web_search',
      policy: {
        ...basePolicy,
        useSupervisor: true,
        requireApproval: {
          always: false,
          forTools: ['send_email'],
          approvalTimeoutSeconds: 300,
          timeoutBehavior: 'deny' as const,
        },
      },
    };
    expect(rule.evaluate(ctx).verdict).toBe('SUPERVISOR');
  });

  it('returns null when tool not in forTools and no supervisor', () => {
    const ctx = {
      ...baseCtx(),
      toolName: 'web_search',
      policy: {
        ...basePolicy,
        requireApproval: {
          always: false,
          forTools: ['send_email'],
          approvalTimeoutSeconds: 300,
          timeoutBehavior: 'deny' as const,
        },
      },
    };
    expect(rule.evaluate(ctx).verdict).toBeNull();
  });
});
