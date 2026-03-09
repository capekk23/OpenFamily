import express, { Express } from 'express';
import pinoHttp from 'pino-http';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { logger } from './logger.js';
import { PolicyChecker } from './interceptor/PolicyChecker.js';
import { SupervisorClient } from './interceptor/SupervisorClient.js';
import { ApprovalWaiter } from './interceptor/ApprovalWaiter.js';
import { GatewayInterceptor } from './interceptor/GatewayInterceptor.js';
import { createInterceptRouter } from './routes/intercept.routes.js';
import { RedisRateLimitStore } from './interceptor/RedisRateLimitStore.js';
import {
  createApprovalTimeoutQueue,
  createApprovalTimeoutWorker,
} from './jobs/approvalTimeout.job.js';

const PORT = Number(process.env.GATEWAY_PORT ?? 3001);
const SUPERVISOR_URL = process.env.SUPERVISOR_URL ?? 'http://localhost:3003';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

const prisma = new PrismaClient();
const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const rateLimitStore = new RedisRateLimitStore(redis);

const policyChecker = new PolicyChecker(rateLimitStore);
const supervisorClient = new SupervisorClient(SUPERVISOR_URL);
const approvalWaiter = new ApprovalWaiter(redis);
const timeoutQueue = createApprovalTimeoutQueue(redis);
const timeoutWorker = createApprovalTimeoutWorker(prisma, redis);

const interceptor = new GatewayInterceptor(
  prisma,
  policyChecker,
  supervisorClient,
  approvalWaiter,
  timeoutQueue
);

const app: Express = express();

// Security headers (no CSP needed — agent-facing API, not browser)
app.use(helmet({ contentSecurityPolicy: false }));

app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === '/health' },
}));
app.use(express.json({ limit: '512kb' }));

// Rate limiting — 600 intercept calls per minute per IP (agents may be fast)
const interceptLimiter = rateLimit({
  windowMs: 60_000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by API key header if present, else IP
    return String(req.headers['x-openfamily-key'] ?? req.ip ?? 'unknown');
  },
  message: { error: 'Rate limit exceeded' },
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'gateway' }));

app.use('/v1', interceptLimiter, createInterceptRouter(prisma, interceptor));

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Gateway listening');
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gateway…');
  server.close();
  await timeoutWorker.close();
  await timeoutQueue.close();
  await prisma.$disconnect();
  redis.quit();
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app };
