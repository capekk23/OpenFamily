import { PolicyRules } from './schema/policy.schema.js';

export { PolicyRules };

export type Verdict = 'APPROVE' | 'BLOCK' | 'SUPERVISOR' | 'HUMAN_APPROVAL';

export interface EvaluationContext {
  sessionId: string;
  agentId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  estimatedCost?: number;
  spentBudget: number;
  policy: PolicyRules;
}

export interface EvaluationResult {
  verdict: Verdict;
  reason: string;
  ruleName: string;
}

export interface RuleResult {
  verdict: Verdict | null; // null = no opinion (pass through)
  reason?: string;
}

export interface PolicyRule {
  name: string;
  evaluate(ctx: EvaluationContext): Promise<RuleResult> | RuleResult;
}

export interface RateLimitStore {
  incrementAndCheck(
    key: string,
    windowSeconds: number,
    maxCalls: number
  ): Promise<{ allowed: boolean; count: number }>;
}
