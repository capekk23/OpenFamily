import { PolicyEvaluator, EvaluationContext, EvaluationResult, RateLimitStore } from '@openfamily/policy-engine';

export class PolicyChecker {
  private evaluator: PolicyEvaluator;

  constructor(rateLimitStore: RateLimitStore) {
    this.evaluator = new PolicyEvaluator(rateLimitStore);
  }

  async check(ctx: EvaluationContext): Promise<EvaluationResult> {
    return this.evaluator.evaluate(ctx);
  }
}
