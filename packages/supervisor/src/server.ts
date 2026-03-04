import express, { Express } from 'express';
import { SupervisorAgent } from './agent/SupervisorAgent.js';
import { createEvaluateRouter } from './routes/evaluate.routes.js';

const PORT = Number(process.env.SUPERVISOR_PORT ?? 3003);

const agent = new SupervisorAgent();
const app: Express = express();
app.use(express.json());

// Internal-only — no auth middleware (network-level isolation in production)
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'supervisor' }));

app.use('/v1/evaluate', createEvaluateRouter(agent));

app.listen(PORT, () => {
  console.log(`Supervisor listening on port ${PORT}`);
});

export { app };
