import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

/** Create a test policy + API key, return objects needed by tests */
export async function seedPolicy(rules: object = {}) {
  const policy = await prisma.policy.create({
    data: {
      name: `test-policy-${randomBytes(4).toString('hex')}`,
      rules: {
        blockedTools: [],
        allowedDomains: [],
        useSupervisor: false,
        ...rules,
      },
    },
  });

  const plaintext = `of_test_${randomBytes(16).toString('hex')}`;
  const keyHash = createHash('sha256').update(plaintext).digest('hex');

  const apiKey = await prisma.apiKey.create({
    data: { name: 'test-key', policyId: policy.id, keyHash },
  });

  return { policy, apiKey, plaintext };
}

export async function seedSession(policyId: string, keyHash: string) {
  return prisma.agentSession.create({
    data: { agentId: 'test-agent', policyId, apiKeyHash: keyHash },
  });
}

/** Truncate all tables after each test for isolation */
export async function truncateAll() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ApprovalRequest", "ActionEvent", "AgentSession",
      "ApiKey", "Policy", "User"
    CASCADE;
  `);
}
