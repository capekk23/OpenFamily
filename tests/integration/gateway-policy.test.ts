/**
 * Integration test: full intercept flow through gateway
 * Requires: DATABASE_URL + REDIS_URL env vars, DB migrated
 *
 * These tests use the PolicyEvaluator directly (not the HTTP server)
 * to test the full policy → event-write pipeline without network overhead.
 */
import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { PolicyEvaluator } from '@openfamily/policy-engine';
import { prisma, seedPolicy, seedSession, truncateAll } from './helpers/db.js';

let redis: Redis;

beforeAll(async () => {
  redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });
});

afterEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await redis.quit();
  await prisma.$disconnect();
});

describe('Gateway policy evaluation → DB event write', () => {
  it('APPROVE: writes APPROVED ActionEvent to DB', async () => {
    const { policy, apiKey } = await seedPolicy({ blockedTools: [], allowedDomains: [], useSupervisor: false });
    const session = await seedSession(policy.id, apiKey.keyHash);

    const rateLimitStore = {
      incrementAndCheck: async () => ({ allowed: true, count: 1 }),
    };
    const evaluator = new PolicyEvaluator(rateLimitStore);

    const result = await evaluator.evaluate({
      sessionId: session.id,
      agentId: 'agent-1',
      toolName: 'web_search',
      toolInput: { query: 'hello' },
      spentBudget: 0,
      policy: { blockedTools: [], allowedDomains: [], useSupervisor: false },
    });

    expect(result.verdict).toBe('APPROVE');

    // Write event like GatewayInterceptor would
    const event = await prisma.actionEvent.create({
      data: {
        sessionId: session.id,
        policyId: policy.id,
        toolName: 'web_search',
        toolInput: { query: 'hello' },
        decision: 'APPROVED',
        reason: result.reason,
      },
    });

    const saved = await prisma.actionEvent.findUnique({ where: { id: event.id } });
    expect(saved).not.toBeNull();
    expect(saved!.decision).toBe('APPROVED');
    expect(saved!.toolName).toBe('web_search');
  });

  it('BLOCK: writes BLOCKED ActionEvent to DB', async () => {
    const { policy, apiKey } = await seedPolicy({ blockedTools: ['send_email'], allowedDomains: [], useSupervisor: false });
    const session = await seedSession(policy.id, apiKey.keyHash);

    const rateLimitStore = { incrementAndCheck: async () => ({ allowed: true, count: 1 }) };
    const evaluator = new PolicyEvaluator(rateLimitStore);

    const result = await evaluator.evaluate({
      sessionId: session.id,
      agentId: 'agent-1',
      toolName: 'send_email',
      toolInput: { to: 'x@x.com' },
      spentBudget: 0,
      policy: { blockedTools: ['send_email'], allowedDomains: [], useSupervisor: false },
    });

    expect(result.verdict).toBe('BLOCK');

    await prisma.actionEvent.create({
      data: {
        sessionId: session.id,
        policyId: policy.id,
        toolName: 'send_email',
        toolInput: { to: 'x@x.com' },
        decision: 'BLOCKED',
        reason: result.reason,
      },
    });

    const count = await prisma.actionEvent.count({ where: { decision: 'BLOCKED', sessionId: session.id } });
    expect(count).toBe(1);
  });

  it('HUMAN_APPROVAL: creates ApprovalRequest when tool requires approval', async () => {
    const rules = {
      blockedTools: [],
      allowedDomains: [],
      useSupervisor: false,
      requireApproval: {
        always: false,
        forTools: ['send_email'],
        approvalTimeoutSeconds: 300,
        timeoutBehavior: 'deny',
      },
    };
    const { policy, apiKey } = await seedPolicy(rules);
    const session = await seedSession(policy.id, apiKey.keyHash);

    const rateLimitStore = { incrementAndCheck: async () => ({ allowed: true, count: 1 }) };
    const evaluator = new PolicyEvaluator(rateLimitStore);

    const result = await evaluator.evaluate({
      sessionId: session.id,
      agentId: 'agent-1',
      toolName: 'send_email',
      toolInput: { to: 'x@x.com' },
      spentBudget: 0,
      policy: rules as never,
    });

    expect(result.verdict).toBe('HUMAN_APPROVAL');

    // Create event + approval request like GatewayInterceptor
    const event = await prisma.actionEvent.create({
      data: {
        sessionId: session.id,
        policyId: policy.id,
        toolName: 'send_email',
        toolInput: {},
        decision: 'PENDING_HUMAN',
        reason: result.reason,
      },
    });

    const expiresAt = new Date(Date.now() + 300_000);
    const approval = await prisma.approvalRequest.create({
      data: { eventId: event.id, sessionId: session.id, expiresAt },
    });

    const saved = await prisma.approvalRequest.findUnique({ where: { id: approval.id } });
    expect(saved!.status).toBe('PENDING');
    expect(saved!.eventId).toBe(event.id);
  });

  it('rate limit: writes BLOCKED event when rate exceeded', async () => {
    const { policy, apiKey } = await seedPolicy({
      blockedTools: [],
      allowedDomains: [],
      useSupervisor: false,
      rateLimits: { callsPerMinute: 2, callsPerHour: 100 },
    });
    const session = await seedSession(policy.id, apiKey.keyHash);

    // Track counts per window key — separate minute and hour counters
    const counters: Record<string, number> = {};
    const rateLimitStore = {
      incrementAndCheck: async (key: string, _window: number, maxCalls: number) => {
        counters[key] = (counters[key] ?? 0) + 1;
        return { allowed: counters[key] <= maxCalls, count: counters[key] };
      },
    };
    const evaluator = new PolicyEvaluator(rateLimitStore);

    const policyRules = { blockedTools: [] as string[], allowedDomains: [] as string[], useSupervisor: false, rateLimits: { callsPerMinute: 2, callsPerHour: 100 } };

    const r1 = await evaluator.evaluate({ sessionId: session.id, agentId: 'a', toolName: 'web_search', toolInput: {}, spentBudget: 0, policy: policyRules });
    const r2 = await evaluator.evaluate({ sessionId: session.id, agentId: 'a', toolName: 'web_search', toolInput: {}, spentBudget: 0, policy: policyRules });
    const r3 = await evaluator.evaluate({ sessionId: session.id, agentId: 'a', toolName: 'web_search', toolInput: {}, spentBudget: 0, policy: policyRules });

    expect(r1.verdict).toBe('APPROVE');
    expect(r2.verdict).toBe('APPROVE');
    expect(r3.verdict).toBe('BLOCK');
  });
});
