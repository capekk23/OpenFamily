import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { PolicyRulesSchema } from '@openfamily/policy-engine';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const PolicyBodySchema = z.object({
  name: z.string().min(1),
  rules: PolicyRulesSchema,
  isActive: z.boolean().optional(),
});

export function createPoliciesRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.use(requireAuth);

  router.get('/', async (_req, res) => {
    const policies = await prisma.policy.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        version: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { sessions: true, events: true } },
      },
    });
    res.json(policies);
  });

  router.post('/', requireRole('ADMIN'), async (req, res) => {
    const parsed = PolicyBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const policy = await prisma.policy.create({
      data: {
        name: parsed.data.name,
        rules: parsed.data.rules,
        isActive: parsed.data.isActive ?? true,
      },
    });
    res.status(201).json(policy);
  });

  router.get('/:id', async (req, res) => {
    const policy = await prisma.policy.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!policy) {
      res.status(404).json({ error: 'Policy not found' });
      return;
    }
    res.json(policy);
  });

  router.put('/:id', requireRole('ADMIN'), async (req, res) => {
    const parsed = PolicyBodySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const existing = await prisma.policy.findUnique({ where: { id: String(req.params.id) } });
    if (!existing) {
      res.status(404).json({ error: 'Policy not found' });
      return;
    }

    const policy = await prisma.policy.update({
      where: { id: String(req.params.id) },
      data: {
        ...(parsed.data.name && { name: parsed.data.name }),
        ...(parsed.data.rules && { rules: parsed.data.rules }),
        ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
        version: { increment: 1 },
      },
    });
    res.json(policy);
  });

  router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
    const existing = await prisma.policy.findUnique({ where: { id: String(req.params.id) } });
    if (!existing) {
      res.status(404).json({ error: 'Policy not found' });
      return;
    }
    await prisma.policy.update({
      where: { id: String(req.params.id) },
      data: { isActive: false },
    });
    res.json({ ok: true });
  });

  return router;
}
