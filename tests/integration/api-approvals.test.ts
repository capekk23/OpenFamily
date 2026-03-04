/**
 * Integration test: Approval resolution via Redis pub-sub
 * Tests that publishing to the Redis channel unblocks ApprovalWaiter.
 */
import { describe, it, expect, afterEach, afterAll, beforeAll } from 'vitest';
import Redis from 'ioredis';
import { prisma, seedPolicy, seedSession, truncateAll } from './helpers/db.js';

const CHANNEL_PREFIX = 'approvals:resolved:';

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

describe('Approval resolution via Redis pub-sub', () => {
  it('creates ApprovalRequest with PENDING status', async () => {
    const { policy, apiKey } = await seedPolicy();
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
        expiresAt: new Date(Date.now() + 300_000),
      },
    });

    expect(approval.status).toBe('PENDING');
  });

  it('resolves approval and publishes Redis message', async () => {
    const { policy, apiKey } = await seedPolicy();
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
        expiresAt: new Date(Date.now() + 300_000),
      },
    });

    // Set up subscriber BEFORE publishing
    const received = await new Promise<string>((resolve) => {
      const subscriber = redis.duplicate();
      const channel = `${CHANNEL_PREFIX}${approval.id}`;
      subscriber.subscribe(channel, () => {
        // Resolve approval from "another service" (simulates API service)
        redis.publish(
          channel,
          JSON.stringify({ outcome: 'APPROVED_BY_HUMAN', reviewNote: 'Looks good', resolvedBy: 'user-1' })
        );
      });
      subscriber.on('message', (_ch, msg) => {
        subscriber.quit();
        resolve(msg);
      });
    });

    const payload = JSON.parse(received);
    expect(payload.outcome).toBe('APPROVED_BY_HUMAN');
    expect(payload.reviewNote).toBe('Looks good');

    // Update DB as the API would
    await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: { status: 'APPROVED', resolvedBy: 'user-1' },
    });

    const saved = await prisma.approvalRequest.findUnique({ where: { id: approval.id } });
    expect(saved!.status).toBe('APPROVED');
  });

  it('deny resolution updates DB to DENIED', async () => {
    const { policy, apiKey } = await seedPolicy();
    const session = await seedSession(policy.id, apiKey.keyHash);

    const event = await prisma.actionEvent.create({
      data: {
        sessionId: session.id,
        policyId: policy.id,
        toolName: 'delete_file',
        toolInput: {},
        decision: 'PENDING_HUMAN',
        reason: 'requires approval',
      },
    });

    const approval = await prisma.approvalRequest.create({
      data: {
        eventId: event.id,
        sessionId: session.id,
        expiresAt: new Date(Date.now() + 300_000),
      },
    });

    await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: { status: 'DENIED', resolvedBy: 'user-1', reviewNote: 'Too risky' },
    });

    await prisma.actionEvent.update({
      where: { id: event.id },
      data: { decision: 'DENIED_BY_HUMAN', reason: 'Too risky' },
    });

    const savedApproval = await prisma.approvalRequest.findUnique({ where: { id: approval.id } });
    const savedEvent = await prisma.actionEvent.findUnique({ where: { id: event.id } });

    expect(savedApproval!.status).toBe('DENIED');
    expect(savedEvent!.decision).toBe('DENIED_BY_HUMAN');
    expect(savedApproval!.reviewNote).toBe('Too risky');
  });
});
