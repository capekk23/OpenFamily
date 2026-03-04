import { PolicyRule, EvaluationContext, RuleResult } from '../../types.js';

export class RequiredApprovalRule implements PolicyRule {
  name = 'RequiredApprovalRule';

  evaluate(ctx: EvaluationContext): RuleResult {
    const { requireApproval, useSupervisor } = ctx.policy;

    if (!requireApproval) {
      if (useSupervisor) {
        return {
          verdict: 'SUPERVISOR',
          reason: 'Policy requires supervisor evaluation',
        };
      }
      return { verdict: null };
    }

    if (requireApproval.always) {
      return {
        verdict: 'HUMAN_APPROVAL',
        reason: 'Policy requires human approval for all tool calls',
      };
    }

    if (requireApproval.forTools.includes(ctx.toolName)) {
      return {
        verdict: 'HUMAN_APPROVAL',
        reason: `Policy requires human approval for tool "${ctx.toolName}"`,
      };
    }

    if (useSupervisor) {
      return {
        verdict: 'SUPERVISOR',
        reason: 'Policy requires supervisor evaluation',
      };
    }

    return { verdict: null };
  }
}
