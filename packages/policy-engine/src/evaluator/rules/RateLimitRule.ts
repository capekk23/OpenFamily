import { PolicyRule, EvaluationContext, RuleResult, RateLimitStore } from '../../types.js';

export class RateLimitRule implements PolicyRule {
  name = 'RateLimitRule';

  constructor(private readonly store: RateLimitStore) {}

  async evaluate(ctx: EvaluationContext): Promise<RuleResult> {
    const { rateLimits } = ctx.policy;

    if (!rateLimits) {
      return { verdict: null };
    }

    const sessionKey = `ratelimit:${ctx.sessionId}`;

    const perMinute = await this.store.incrementAndCheck(
      `${sessionKey}:minute`,
      60,
      rateLimits.callsPerMinute
    );

    if (!perMinute.allowed) {
      return {
        verdict: 'BLOCK',
        reason: `Rate limit exceeded: ${perMinute.count} calls in last minute (max ${rateLimits.callsPerMinute})`,
      };
    }

    const perHour = await this.store.incrementAndCheck(
      `${sessionKey}:hour`,
      3600,
      rateLimits.callsPerHour
    );

    if (!perHour.allowed) {
      return {
        verdict: 'BLOCK',
        reason: `Rate limit exceeded: ${perHour.count} calls in last hour (max ${rateLimits.callsPerHour})`,
      };
    }

    return { verdict: null };
  }
}
