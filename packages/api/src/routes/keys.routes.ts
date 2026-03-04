import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const CreateKeySchema = z.object({
  name: z.string().min(1),
  policyId: z.string(),
});

export function createKeysRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.use(requireAuth, requireRole('ADMIN'));

  router.get('/', async (_req, res) => {
    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        policyId: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        policy: { select: { name: true } },
      },
    });
    res.json(keys);
  });

  router.post('/', async (req, res) => {
    const parsed = CreateKeySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const policy = await prisma.policy.findUnique({
      where: { id: parsed.data.policyId, isActive: true },
    });
    if (!policy) {
      res.status(404).json({ error: 'Policy not found or inactive' });
      return;
    }

    const plaintext = `of_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(plaintext).digest('hex');

    const key = await prisma.apiKey.create({
      data: {
        name: parsed.data.name,
        policyId: parsed.data.policyId,
        keyHash,
      },
    });

    // Return plaintext key ONCE — never stored
    res.status(201).json({ id: key.id, name: key.name, key: plaintext });
  });

  router.delete('/:id', async (req, res) => {
    const key = await prisma.apiKey.findUnique({ where: { id: req.params.id } });
    if (!key) {
      res.status(404).json({ error: 'API key not found' });
      return;
    }
    await prisma.apiKey.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ ok: true });
  });

  return router;
}
