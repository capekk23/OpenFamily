import express from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { createAuthRouter } from './routes/auth.routes.js';
import { createPoliciesRouter } from './routes/policies.routes.js';
import { createEventsRouter } from './routes/events.routes.js';
import { createApprovalsRouter } from './routes/approvals.routes.js';
import { createSessionsRouter } from './routes/sessions.routes.js';
import { createKeysRouter } from './routes/keys.routes.js';
import { createDashboardRouter } from './routes/dashboard.routes.js';
import { createSettingsRouter } from './routes/settings.routes.js';
import { createApprovalStreamHandler } from './sse/approvalStream.js';
import { requireAuth } from './middleware/auth.middleware.js';

const PORT = Number(process.env.API_PORT ?? 3002);
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

const prisma = new PrismaClient();
const redis = new Redis(REDIS_URL);

const app = express();
app.use(express.json());

// CORS for dashboard
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.DASHBOARD_URL ?? 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'api' }));

app.use('/api/auth', createAuthRouter(prisma));
app.use('/api/policies', createPoliciesRouter(prisma));
app.use('/api/events', createEventsRouter(prisma));
app.use('/api/approvals', createApprovalsRouter(prisma, redis));
app.use('/api/sessions', createSessionsRouter(prisma));
app.use('/api/keys', createKeysRouter(prisma));
app.use('/api/dashboard', createDashboardRouter(prisma));
app.use('/api/settings', createSettingsRouter(prisma));

// SSE stream
app.get('/api/approvals/stream', requireAuth, createApprovalStreamHandler(redis));

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});

export { app };
