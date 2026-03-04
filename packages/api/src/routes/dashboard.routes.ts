import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.middleware.js';

export function createDashboardRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.use(requireAuth);

  router.get('/stats', async (_req, res) => {
    const [
      totalSessions,
      activeSessions,
      totalEvents,
      pendingApprovals,
      eventsByDecision,
    ] = await Promise.all([
      prisma.agentSession.count(),
      prisma.agentSession.count({ where: { status: 'ACTIVE' } }),
      prisma.actionEvent.count(),
      prisma.approvalRequest.count({ where: { status: 'PENDING' } }),
      prisma.actionEvent.groupBy({
        by: ['decision'],
        _count: { decision: true },
      }),
    ]);

    res.json({
      totalSessions,
      activeSessions,
      totalEvents,
      pendingApprovals,
      eventsByDecision: Object.fromEntries(
        eventsByDecision.map((e) => [e.decision, e._count.decision])
      ),
    });
  });

  return router;
}
