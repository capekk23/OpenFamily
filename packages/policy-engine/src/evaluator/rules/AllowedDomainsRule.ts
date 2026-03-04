import { PolicyRule, EvaluationContext, RuleResult } from '../../types.js';

function matchesDomain(domain: string, pattern: string): boolean {
  if (pattern === '*') return true;

  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2); // remove '*.'
    return domain === suffix || domain.endsWith('.' + suffix);
  }

  return domain === pattern;
}

function extractDomain(input: Record<string, unknown>): string | null {
  // Check common fields where a URL/domain might be passed
  const candidates = [input.url, input.domain, input.host, input.endpoint];
  for (const c of candidates) {
    if (typeof c !== 'string') continue;
    try {
      const url = new URL(c.startsWith('http') ? c : `https://${c}`);
      return url.hostname;
    } catch {
      // not a URL, try as plain domain
      if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(c)) return c;
    }
  }
  return null;
}

export class AllowedDomainsRule implements PolicyRule {
  name = 'AllowedDomainsRule';

  evaluate(ctx: EvaluationContext): RuleResult {
    const { allowedDomains } = ctx.policy;

    // Only applies when allowedDomains list is non-empty
    if (!allowedDomains || allowedDomains.length === 0) {
      return { verdict: null };
    }

    const domain = extractDomain(ctx.toolInput);

    // If no domain found in input, this rule doesn't apply
    if (!domain) {
      return { verdict: null };
    }

    const allowed = allowedDomains.some((pattern) => matchesDomain(domain, pattern));

    if (!allowed) {
      return {
        verdict: 'BLOCK',
        reason: `Domain "${domain}" is not in the allowed domains list`,
      };
    }

    return { verdict: null };
  }
}
