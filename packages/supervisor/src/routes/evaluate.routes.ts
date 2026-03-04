import { Router } from 'express';
import { z } from 'zod';
import { SupervisorAgent } from '../agent/SupervisorAgent.js';

const EvaluateSchema = z.object({
  toolName: z.string(),
  toolInput: z.record(z.unknown()),
  sessionId: z.string(),
  policyId: z.string(),
  spentBudget: z.number(),
  policyRules: z.unknown(),
});

export function createEvaluateRouter(agent: SupervisorAgent): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const parsed = EvaluateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const result = await agent.evaluate(parsed.data);
    res.json(result);
  });

  return router;
}
