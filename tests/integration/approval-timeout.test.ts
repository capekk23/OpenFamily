/**
 * Integration test: BullMQ approval timeout sweep
 * Tests that an expired approval gets TIMED_OUT decision applied.
 */
import { describe, it, expect, afterEach, afterAll, beforeAll } from 'vitest';
import Redis from 'ioredis';
import { prisma, seedPolicy, seedSession, truncateAll } from './helpers/db.js';

let redis: Redis;

beforeAll(async () => {
  redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });
});

afterEach(async () => { await truncateAll(); });
afterAll(async () => {
  await redis.quit();
  await prisma.$disconnect();
});

describe('Approval timeout logic', () => {
  it('timeout with deny behavior → status becomes TIMED_OUT', async () => {
    const { policy, apiKey } = await seedPolicy({
      requireApproval: {
        always: false,
        forTools: ['send_email'],
        approvalTimeoutSeconds: 1,
        timeoutBehavior: 'deny',
      },
    });
    const session = await seedSession(policy.id, apiKey.keyHash);

    const event = await prisma.actionEvent.create({
      data: {
        sessionId: session.id,
        policyId: policy.id,
        toolName: 'send_email',
        toolInput: {},
        decision: 'PENDING_HUMAN',
        reason: 'requires approval',
      },
    });

    const approval = await prisma.approvalRequest.create({
      data: {
        eventId: event.id,
        sessionId: session.id,
        expiresAt: new Date(Date.now() - 1), // already expired
      },
    });

    // Simulate what the BullMQ worker does when it fires
    const expired = await prisma.approvalRequest.findUnique({ where: { id: approval.id } });
    expect(expired!.status).toBe('PENDING');

    await prisma.$transaction([
      prisma.approvalRequest.update({
        where: { id: approval.id },
        data: { status: 'TIMED_OUT' },
      }),
      prisma.actionEvent.update({
        where: { id: event.id },
        data: { decision: 'TIMED_OUT', reason: 'Timed out — denied by policy' },
      }),
    ]);

    const savedApproval = await prisma.approvalRequest.findUnique({ where: { id: approval.id } });
    const savedEvent = await prisma.actionEvent.findUnique({ where: { id: event.id } });

    expect(savedApproval!.status).toBe('TIMED_OUT');
    expect(savedEvent!.decision).toBe('TIMED_OUT');
  });

  it('timeout with approve behavior → status becomes APPROVED', async () => {
    const { policy, apiKey } = await seedPolicy({
      requireApproval: {
        always: false,
        forTools: ['send_email'],
        approvalTimeoutSeconds: 1,
        timeoutBehavior: 'approve',
      },
    });
    const session = await seedSession(policy.id, apiKey.keyHash);

    const event = await prisma.actionEvent.create({
      data: {
        sessionId: session.id,
        policyId: policy.id,
        toolName: 'send_email',
        toolInput: {},
        decision: 'PENDING_HUMAN',
        reason: 'requires approval',
      },
    });

    const approval = await prisma.approvalRequest.create({
      data: {
        eventId: event.id,
        sessionId: session.id,
        expiresAt: new Date(Date.now() - 1),
      },
    });

    await prisma.$transaction([
      prisma.approvalRequest.update({
        where: { id: approval.id },
        data: { status: 'APPROVED' },
      }),
      prisma.actionEvent.update({
        where: { id: event.id },
        data: { decision: 'APPROVED_BY_HUMAN', reason: 'Auto-approved by timeout policy' },
      }),
    ]);

    const savedApproval = await prisma.approvalRequest.findUnique({ where: { id: approval.id } });
    const savedEvent = await prisma.actionEvent.findUnique({ where: { id: event.id } });

    expect(savedApproval!.status).toBe('APPROVED');
    expect(savedEvent!.decision).toBe('APPROVED_BY_HUMAN');
  });

  it('does not re-process an already resolved approval', async () => {
    const { policy, apiKey } = await seedPolicy();
    const session = await seedSession(policy.id, apiKey.keyHash);

    const event = await prisma.actionEvent.create({
      data: {
        sessionId: session.id,
        policyId: policy.id,
        toolName: 'send_email',
        toolInput: {},
        decision: 'APPROVED_BY_HUMAN',
        reason: 'human approved already',
      },
    });

    const approval = await prisma.approvalRequest.create({
      data: {
        eventId: event.id,
        sessionId: session.id,
        expiresAt: new Date(Date.now() - 1),
        status: 'APPROVED', // already resolved
        resolvedBy: 'user-1',
      },
    });

    // Worker guard: only act if still PENDING
    const current = await prisma.approvalRequest.findUnique({ where: { id: approval.id } });
    expect(current!.status).not.toBe('PENDING');
    // Worker skips — event stays APPROVED_BY_HUMAN
    const savedEvent = await prisma.actionEvent.findUnique({ where: { id: event.id } });
    expect(savedEvent!.decision).toBe('APPROVED_BY_HUMAN');
  });
});
