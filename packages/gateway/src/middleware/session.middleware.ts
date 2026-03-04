import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { PolicyRulesSchema, PolicyRules } from '@openfamily/policy-engine';

declare global {
  namespace Express {
    interface Request {
      session?: {
        id: string;
        agentId: string;
        policyId: string;
        spentBudget: number;
        policy: PolicyRules;
      };
    }
  }
}

export function createSessionMiddleware(prisma: PrismaClient) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const sessionId = req.body?.sessionId || req.params?.sessionId;
    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }

    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId, status: 'ACTIVE' },
      include: { policy: true },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found or not active' });
      return;
    }

    // Ensure this session belongs to the calling API key
    if (session.apiKeyHash !== req.apiKey!.keyHash) {
      res.status(403).json({ error: 'Session does not belong to this API key' });
      return;
    }

    const parsed = PolicyRulesSchema.safeParse(session.policy.rules);
    if (!parsed.success) {
      res.status(500).json({ error: 'Policy rules are invalid' });
      return;
    }

    req.session = {
      id: session.id,
      agentId: session.agentId,
      policyId: session.policyId,
      spentBudget: Number(session.spentBudget),
      policy: parsed.data,
    };

    next();
  };
}
