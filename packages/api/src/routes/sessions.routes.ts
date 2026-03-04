import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const SessionsQuerySchema = z.object({
  policyId: z.string().optional(),
  status: z.enum(['ACTIVE', 'TERMINATED', 'EXPIRED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export function createSessionsRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const parsed = SessionsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { policyId, status, page, limit } = parsed.data;
    const skip = (page - 1) * limit;

    const where = {
      ...(policyId && { policyId }),
      ...(status && { status }),
    };

    const [sessions, total] = await Promise.all([
      prisma.agentSession.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
        include: {
          policy: { select: { id: true, name: true } },
          _count: { select: { events: true, approvals: true } },
        },
      }),
      prisma.agentSession.count({ where }),
    ]);

    res.json({
      data: sessions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  });

  router.post('/:id/terminate', requireRole('ADMIN', 'REVIEWER'), async (req, res) => {
    const session = await prisma.agentSession.findUnique({
      where: { id: req.params.id },
    });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    await prisma.agentSession.update({
      where: { id: req.params.id },
      data: { status: 'TERMINATED', endedAt: new Date() },
    });

    res.json({ ok: true });
  });

  return router;
}
