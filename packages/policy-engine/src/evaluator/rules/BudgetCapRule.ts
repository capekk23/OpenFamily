import { PolicyRule, EvaluationContext, RuleResult } from '../../types.js';

export class BudgetCapRule implements PolicyRule {
  name = 'BudgetCapRule';

  evaluate(ctx: EvaluationContext): RuleResult {
    const { budgetCap } = ctx.policy;

    if (!budgetCap) {
      return { verdict: null };
    }

    const estimatedCost = ctx.estimatedCost ?? 0;

    if (estimatedCost > budgetCap.maxPerCall) {
      return {
        verdict: 'BLOCK',
        reason: `Estimated cost $${estimatedCost} exceeds per-call cap of $${budgetCap.maxPerCall}`,
      };
    }

    const projectedTotal = ctx.spentBudget + estimatedCost;
    if (projectedTotal > budgetCap.maxPerSession) {
      return {
        verdict: 'BLOCK',
        reason: `Projected session spend $${projectedTotal.toFixed(6)} would exceed session cap of $${budgetCap.maxPerSession}`,
      };
    }

    // Check if close to budget — trigger approval if requireApproval.whenBudgetExceeds set
    const { requireApproval } = ctx.policy;
    if (requireApproval?.whenBudgetExceeds !== undefined) {
      if (projectedTotal > requireApproval.whenBudgetExceeds) {
        return {
          verdict: 'HUMAN_APPROVAL',
          reason: `Projected spend $${projectedTotal.toFixed(6)} exceeds approval threshold $${requireApproval.whenBudgetExceeds}`,
        };
      }
    }

    return { verdict: null };
  }
}
