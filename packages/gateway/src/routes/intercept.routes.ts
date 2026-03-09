import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { createSessionMiddleware } from '../middleware/session.middleware.js';
import { GatewayInterceptor } from '../interceptor/GatewayInterceptor.js';

const CreateSessionSchema = z.object({
  agentId: z.string(),
  agentName: z.string().optional(),
  policyId: z.string().optional(), // if omitted, uses key's policy
});

const InterceptSchema = z.object({
  sessionId: z.string(),
  toolName: z.string(),
  toolInput: z.record(z.unknown()),
  estimatedCost: z.number().nonnegative().optional(),
});

export function createInterceptRouter(
  prisma: PrismaClient,
  interceptor: GatewayInterceptor
): Router {
  const router = Router();
  const auth = createAuthMiddleware(prisma);
  const sessionMiddleware = createSessionMiddleware(prisma);

  // POST /v1/sessions — register a new agent session
  router.post('/sessions', auth, async (req, res) => {
    const parsed = CreateSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { agentId, agentName, policyId } = parsed.data;
    const effectivePolicyId = policyId ?? req.apiKey!.policyId;

    // Verify policy exists
    const policy = await prisma.policy.findUnique({
      where: { id: effectivePolicyId, isActive: true },
    });
    if (!policy) {
      res.status(404).json({ error: 'Policy not found or inactive' });
      return;
    }

    const session = await prisma.agentSession.create({
      data: {
        agentId,
        agentName,
        policyId: effectivePolicyId,
        apiKeyHash: req.apiKey!.keyHash,
      },
    });

    res.status(201).json({ sessionId: session.id });
  });

  // POST /v1/intercept — hot path
  router.post('/intercept', auth, sessionMiddleware, async (req, res) => {
    const parsed = InterceptSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { toolName, toolInput, estimatedCost } = parsed.data;
    const session = req.session!;

    const outcome = await interceptor.intercept({
      sessionId: session.id,
      agentId: session.agentId,
      policyId: session.policyId,
      toolName,
      toolInput,
      estimatedCost,
      spentBudget: session.spentBudget,
      policy: session.policy,
    });

    if (outcome.allowed) {
      res.status(200).json(outcome);
    } else {
      res.status(403).json(outcome);
    }
  });

  // GET /v1/sessions/:sessionId/status
  router.get('/sessions/:sessionId/status', auth, async (req, res) => {
    const session = await prisma.agentSession.findUnique({
      where: { id: String(req.params.sessionId) },
      select: {
        id: true,
        agentId: true,
        agentName: true,
        status: true,
        spentBudget: true,
        startedAt: true,
        _count: { select: { events: true } },
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json(session);
  });

  return router;
}
