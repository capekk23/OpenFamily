import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.middleware.js';

const EventsQuerySchema = z.object({
  sessionId: z.string().optional(),
  policyId: z.string().optional(),
  decision: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export function createEventsRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const parsed = EventsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { sessionId, policyId, decision, page, limit } = parsed.data;
    const skip = (page - 1) * limit;

    const where = {
      ...(sessionId && { sessionId }),
      ...(policyId && { policyId }),
      ...(decision && { decision: decision as never }),
    };

    const [events, total] = await Promise.all([
      prisma.actionEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
        include: { approval: { select: { id: true, status: true } } },
      }),
      prisma.actionEvent.count({ where }),
    ]);

    res.json({
      data: events,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  });

  return router;
}
