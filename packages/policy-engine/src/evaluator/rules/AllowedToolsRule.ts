import { PolicyRule, EvaluationContext, RuleResult } from '../../types.js';

export class AllowedToolsRule implements PolicyRule {
  name = 'AllowedToolsRule';

  evaluate(ctx: EvaluationContext): RuleResult {
    const { allowedTools } = ctx.policy;

    if (!allowedTools || allowedTools.length === 0) {
      return { verdict: null }; // no allowlist configured — no opinion
    }

    if (allowedTools.includes(ctx.toolName)) {
      return { verdict: null }; // in allowlist — pass to next rule
    }

    return {
      verdict: 'BLOCK',
      reason: `Tool "${ctx.toolName}" is not in the allowed tools list`,
    };
  }
}
