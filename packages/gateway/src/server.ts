import express from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { PolicyChecker } from './interceptor/PolicyChecker.js';
import { SupervisorClient } from './interceptor/SupervisorClient.js';
import { ApprovalWaiter } from './interceptor/ApprovalWaiter.js';
import { GatewayInterceptor } from './interceptor/GatewayInterceptor.js';
import { createInterceptRouter } from './routes/intercept.routes.js';
import { RedisRateLimitStore } from './interceptor/RedisRateLimitStore.js';

const PORT = Number(process.env.GATEWAY_PORT ?? 3001);
const SUPERVISOR_URL = process.env.SUPERVISOR_URL ?? 'http://localhost:3003';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

const prisma = new PrismaClient();
const redis = new Redis(REDIS_URL);
const rateLimitStore = new RedisRateLimitStore(redis);

const policyChecker = new PolicyChecker(rateLimitStore);
const supervisorClient = new SupervisorClient(SUPERVISOR_URL);
const approvalWaiter = new ApprovalWaiter(redis);
const interceptor = new GatewayInterceptor(
  prisma,
  policyChecker,
  supervisorClient,
  approvalWaiter
);

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'gateway' }));

app.use('/v1', createInterceptRouter(prisma, interceptor));

app.listen(PORT, () => {
  console.log(`Gateway listening on port ${PORT}`);
});

export { app };
