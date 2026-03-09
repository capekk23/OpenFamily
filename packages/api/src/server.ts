import express, { Express } from 'express';
import pinoHttp from 'pino-http';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { logger } from './logger.js';
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
const DASHBOARD_URL = process.env.DASHBOARD_URL ?? 'http://localhost:3000';

const prisma = new PrismaClient();
const redis = new Redis(REDIS_URL);

const app: Express = express();

// Security headers
app.use(helmet());

// Request logging
app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === '/health' },
}));

// Strict CORS — only allow the dashboard origin
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === DASHBOARD_URL || !origin) {
    res.setHeader('Access-Control-Allow-Origin', DASHBOARD_URL);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

app.use(express.json({ limit: '256kb' }));

// Rate limiting — auth endpoints: 10 req/min per IP
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// General API rate limit: 300 req/min per IP
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'api' }));

app.use('/api/auth', authLimiter, createAuthRouter(prisma));
app.use('/api/policies', apiLimiter, createPoliciesRouter(prisma));
app.use('/api/events', apiLimiter, createEventsRouter(prisma));
app.use('/api/approvals', apiLimiter, createApprovalsRouter(prisma, redis));
app.use('/api/sessions', apiLimiter, createSessionsRouter(prisma));
app.use('/api/keys', apiLimiter, createKeysRouter(prisma));
app.use('/api/dashboard', apiLimiter, createDashboardRouter(prisma));
app.use('/api/settings', apiLimiter, createSettingsRouter(prisma));

// SSE stream
app.get('/api/approvals/stream', requireAuth, createApprovalStreamHandler(redis));

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'API listening');
});

export { app };
