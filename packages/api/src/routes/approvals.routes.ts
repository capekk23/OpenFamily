import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const CHANNEL_PREFIX = 'approvals:resolved:';

const ResolveSchema = z.object({
  reviewNote: z.string().optional(),
});

async function publishResolution(
  redis: Redis,
  approvalId: string,
  outcome: string,
  reviewNote: string | undefined,
  resolvedBy: string
): Promise<void> {
  await redis.publish(
    `${CHANNEL_PREFIX}${approvalId}`,
    JSON.stringify({ outcome, reviewNote, resolvedBy })
  );
}

export function createApprovalsRouter(prisma: PrismaClient, redis: Redis): Router {
  const router = Router();

  router.use(requireAuth);

  router.get('/pending', async (_req, res) => {
    const approvals = await prisma.approvalRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { requestedAt: 'asc' },
      include: {
        event: {
          select: {
            toolName: true,
            toolInput: true,
            sessionId: true,
            policyId: true,
            supervisorNotes: true,
            supervisorUsed: true,
          },
        },
        session: { select: { agentId: true, agentName: true } },
      },
    });
    res.json(approvals);
  });

  router.post('/:id/approve', requireRole('ADMIN', 'REVIEWER'), async (req, res) => {
    const parsed = ResolveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: String(req.params.id), status: 'PENDING' },
    });
    if (!approval) {
      res.status(404).json({ error: 'Approval not found or already resolved' });
      return;
    }

    await prisma.approvalRequest.update({
      where: { id: String(req.params.id) },
      data: {
        status: 'APPROVED',
        resolvedBy: req.user!.userId,
        reviewNote: parsed.data.reviewNote,
      },
    });

    await publishResolution(redis, String(req.params.id), 'APPROVED_BY_HUMAN', parsed.data.reviewNote, req.user!.userId);

    res.json({ ok: true });
  });

  router.post('/:id/deny', requireRole('ADMIN', 'REVIEWER'), async (req, res) => {
    const parsed = ResolveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: String(req.params.id), status: 'PENDING' },
    });
    if (!approval) {
      res.status(404).json({ error: 'Approval not found or already resolved' });
      return;
    }

    await prisma.approvalRequest.update({
      where: { id: String(req.params.id) },
      data: {
        status: 'DENIED',
        resolvedBy: req.user!.userId,
        reviewNote: parsed.data.reviewNote,
      },
    });

    await publishResolution(redis, String(req.params.id), 'DENIED_BY_HUMAN', parsed.data.reviewNote, req.user!.userId);

    res.json({ ok: true });
  });

  return router;
}
