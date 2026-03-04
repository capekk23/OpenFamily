import { EvaluationContext, EvaluationResult, PolicyRule, Verdict } from '../types.js';
import { AllowedToolsRule } from './rules/AllowedToolsRule.js';
import { BlockedToolsRule } from './rules/BlockedToolsRule.js';
import { BudgetCapRule } from './rules/BudgetCapRule.js';
import { RateLimitRule } from './rules/RateLimitRule.js';
import { AllowedDomainsRule } from './rules/AllowedDomainsRule.js';
import { RequiredApprovalRule } from './rules/RequiredApprovalRule.js';
import { RateLimitStore } from '../types.js';

// Verdict precedence — higher index wins (BLOCK beats all)
const VERDICT_PRIORITY: Record<Verdict, number> = {
  APPROVE: 0,
  SUPERVISOR: 1,
  HUMAN_APPROVAL: 2,
  BLOCK: 3,
};

export class PolicyEvaluator {
  private readonly rules: PolicyRule[];

  constructor(rateLimitStore: RateLimitStore) {
    this.rules = [
      new AllowedToolsRule(),
      new BlockedToolsRule(),
      new BudgetCapRule(),
      new RateLimitRule(rateLimitStore),
      new AllowedDomainsRule(),
      new RequiredApprovalRule(),
    ];
  }

  async evaluate(ctx: EvaluationContext): Promise<EvaluationResult> {
    let highestVerdict: Verdict = 'APPROVE';
    let highestReason = 'All policy rules passed';
    let highestRuleName = 'PolicyEvaluator';

    for (const rule of this.rules) {
      const result = await rule.evaluate(ctx);

      if (result.verdict === null) continue;

      const priority = VERDICT_PRIORITY[result.verdict];
      if (priority > VERDICT_PRIORITY[highestVerdict]) {
        highestVerdict = result.verdict;
        highestReason = result.reason ?? rule.name;
        highestRuleName = rule.name;

        // BLOCK is final — no need to check remaining rules
        if (highestVerdict === 'BLOCK') break;
      }
    }

    return {
      verdict: highestVerdict,
      reason: highestReason,
      ruleName: highestRuleName,
    };
  }
}
