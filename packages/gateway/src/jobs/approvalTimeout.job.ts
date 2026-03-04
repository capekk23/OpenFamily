import { Queue, Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { ApprovalWaiter } from '../interceptor/ApprovalWaiter.js';

const QUEUE_NAME = 'approval-timeout';

export interface ApprovalTimeoutJobData {
  approvalId: string;
  eventId: string;
  timeoutBehavior: 'approve' | 'deny';
}

export function createApprovalTimeoutQueue(redis: Redis): Queue<ApprovalTimeoutJobData> {
  return new Queue(QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: { removeOnComplete: 100, removeOnFail: 100 },
  });
}

export function scheduleApprovalTimeout(
  queue: Queue<ApprovalTimeoutJobData>,
  approvalId: string,
  eventId: string,
  timeoutSeconds: number,
  timeoutBehavior: 'approve' | 'deny'
): Promise<void> {
  return queue.add(
    'timeout',
    { approvalId, eventId, timeoutBehavior },
    { delay: timeoutSeconds * 1000, jobId: `approval-timeout:${approvalId}` }
  ).then(() => {});
}

export function createApprovalTimeoutWorker(
  prisma: PrismaClient,
  redis: Redis
): Worker<ApprovalTimeoutJobData> {
  return new Worker<ApprovalTimeoutJobData>(
    QUEUE_NAME,
    async (job: Job<ApprovalTimeoutJobData>) => {
      const { approvalId, eventId, timeoutBehavior } = job.data;

      // Only act if still PENDING — human may have already resolved it
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: approvalId },
      });

      if (!approval || approval.status !== 'PENDING') return;

      const finalDecision = timeoutBehavior === 'approve' ? 'APPROVED_BY_HUMAN' : 'TIMED_OUT';
      const finalApprovalStatus = timeoutBehavior === 'approve' ? 'APPROVED' : 'TIMED_OUT';

      await prisma.$transaction([
        prisma.approvalRequest.update({
          where: { id: approvalId },
          data: { status: finalApprovalStatus as never },
        }),
        prisma.actionEvent.update({
          where: { id: eventId },
          data: {
            decision: finalDecision as never,
            reason: `Timed out — ${timeoutBehavior}d by policy`,
          },
        }),
      ]);

      // Publish resolution so ApprovalWaiter unblocks
      await ApprovalWaiter.publish(redis, approvalId, {
        outcome: timeoutBehavior === 'approve' ? 'APPROVED_BY_HUMAN' : 'TIMED_OUT',
        reviewNote: `Auto-${timeoutBehavior}d by timeout policy`,
      });
    },
    { connection: redis }
  );
}
