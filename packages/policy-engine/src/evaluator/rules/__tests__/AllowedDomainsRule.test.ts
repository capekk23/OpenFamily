import { describe, it, expect } from 'vitest';
import { AllowedDomainsRule } from '../AllowedDomainsRule.js';
import { EvaluationContext } from '../../../types.js';

const basePolicy = {
  blockedTools: [],
  allowedDomains: [] as string[],
  useSupervisor: false,
};

const makeCtx = (toolInput: Record<string, unknown>, allowedDomains: string[] = []): EvaluationContext => ({
  sessionId: 'sess-1',
  agentId: 'agent-1',
  toolName: 'http_request',
  toolInput,
  spentBudget: 0,
  policy: { ...basePolicy, allowedDomains },
});

const rule = new AllowedDomainsRule();

describe('AllowedDomainsRule', () => {
  it('returns null when allowedDomains is empty', () => {
    const ctx = makeCtx({ url: 'https://evil.com' }, []);
    expect(rule.evaluate(ctx).verdict).toBeNull();
  });

  it('returns null when no URL in tool input', () => {
    const ctx = makeCtx({ query: 'hello' }, ['google.com']);
    expect(rule.evaluate(ctx).verdict).toBeNull();
  });

  it('allows exact domain match', () => {
    const ctx = makeCtx({ url: 'https://api.google.com/search' }, ['api.google.com']);
    expect(rule.evaluate(ctx).verdict).toBeNull();
  });

  it('blocks domain not in list', () => {
    const ctx = makeCtx({ url: 'https://evil.com/data' }, ['google.com']);
    expect(rule.evaluate(ctx).verdict).toBe('BLOCK');
    expect(rule.evaluate(ctx).reason).toContain('evil.com');
  });

  it('supports wildcard *.domain.com — matches subdomain', () => {
    const ctx = makeCtx({ url: 'https://api.example.com' }, ['*.example.com']);
    expect(rule.evaluate(ctx).verdict).toBeNull();
  });

  it('supports wildcard *.domain.com — matches apex', () => {
    const ctx = makeCtx({ url: 'https://example.com' }, ['*.example.com']);
    expect(rule.evaluate(ctx).verdict).toBeNull();
  });

  it('wildcard does not match different domain', () => {
    const ctx = makeCtx({ url: 'https://notexample.com' }, ['*.example.com']);
    expect(rule.evaluate(ctx).verdict).toBe('BLOCK');
  });

  it('wildcard * matches any domain', () => {
    const ctx = makeCtx({ url: 'https://anything.xyz' }, ['*']);
    expect(rule.evaluate(ctx).verdict).toBeNull();
  });

  it('reads domain from "domain" field', () => {
    const ctx = makeCtx({ domain: 'allowed.com' }, ['allowed.com']);
    expect(rule.evaluate(ctx).verdict).toBeNull();
  });

  it('reads domain from "host" field', () => {
    const ctx = makeCtx({ host: 'allowed.com' }, ['allowed.com']);
    expect(rule.evaluate(ctx).verdict).toBeNull();
  });

  it('deep subdomain blocked by non-wildcard pattern', () => {
    const ctx = makeCtx({ url: 'https://deep.sub.example.com' }, ['example.com']);
    expect(rule.evaluate(ctx).verdict).toBe('BLOCK');
  });
});
