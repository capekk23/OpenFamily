import { PolicyRule, EvaluationContext, RuleResult } from '../../types.js';

export class BlockedToolsRule implements PolicyRule {
  name = 'BlockedToolsRule';

  evaluate(ctx: EvaluationContext): RuleResult {
    const { blockedTools } = ctx.policy;

    if (blockedTools.includes(ctx.toolName)) {
      return {
        verdict: 'BLOCK',
        reason: `Tool "${ctx.toolName}" is explicitly blocked by policy`,
      };
    }

    return { verdict: null };
  }
}
