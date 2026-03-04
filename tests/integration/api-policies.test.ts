/**
 * Integration test: Policy CRUD via direct Prisma + Zod validation
 * Tests that PolicyRulesSchema correctly validates at write time.
 */
import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { PolicyRulesSchema } from '@openfamily/policy-engine';
import { prisma, truncateAll } from './helpers/db.js';

afterEach(async () => { await truncateAll(); });
afterAll(async () => { await prisma.$disconnect(); });

describe('Policy CRUD with Zod validation', () => {
  it('creates a policy with valid rules', async () => {
    const rules = PolicyRulesSchema.parse({
      blockedTools: ['rm_rf'],
      allowedDomains: ['*.google.com'],
      useSupervisor: true,
      requireApproval: {
        always: false,
        forTools: ['send_email'],
        approvalTimeoutSeconds: 120,
        timeoutBehavior: 'deny',
      },
    });

    const policy = await prisma.policy.create({
      data: { name: 'Test Policy', rules },
    });

    const saved = await prisma.policy.findUnique({ where: { id: policy.id } });
    expect(saved).not.toBeNull();
    expect(saved!.name).toBe('Test Policy');
    expect(saved!.version).toBe(1);
    expect(saved!.isActive).toBe(true);

    const savedRules = PolicyRulesSchema.parse(saved!.rules);
    expect(savedRules.blockedTools).toContain('rm_rf');
    expect(savedRules.allowedDomains).toContain('*.google.com');
  });

  it('rejects invalid rules via Zod before DB write', () => {
    const result = PolicyRulesSchema.safeParse({
      blockedTools: 'not-an-array', // wrong type
    });
    expect(result.success).toBe(false);
  });

  it('increments version on update', async () => {
    const policy = await prisma.policy.create({
      data: {
        name: 'Versioned Policy',
        rules: { blockedTools: [], allowedDomains: [], useSupervisor: false },
      },
    });

    const updated = await prisma.policy.update({
      where: { id: policy.id },
      data: {
        name: 'Versioned Policy v2',
        version: { increment: 1 },
      },
    });

    expect(updated.version).toBe(2);
  });

  it('soft-deletes by setting isActive=false', async () => {
    const policy = await prisma.policy.create({
      data: {
        name: 'Deletable Policy',
        rules: { blockedTools: [], allowedDomains: [], useSupervisor: false },
      },
    });

    await prisma.policy.update({ where: { id: policy.id }, data: { isActive: false } });

    const active = await prisma.policy.findFirst({
      where: { id: policy.id, isActive: true },
    });
    expect(active).toBeNull();
  });

  it('lists multiple policies and count matches', async () => {
    // Insert sequentially to ensure stable ordering
    await prisma.policy.create({ data: { name: 'Policy A', rules: { blockedTools: [], allowedDomains: [], useSupervisor: false } } });
    await prisma.policy.create({ data: { name: 'Policy B', rules: { blockedTools: [], allowedDomains: [], useSupervisor: false } } });
    await prisma.policy.create({ data: { name: 'Policy C', rules: { blockedTools: [], allowedDomains: [], useSupervisor: false } } });

    const policies = await prisma.policy.findMany({ orderBy: { createdAt: 'asc' } });
    expect(policies.length).toBe(3);
    const names = policies.map((p) => p.name);
    expect(names).toContain('Policy A');
    expect(names).toContain('Policy B');
    expect(names).toContain('Policy C');
  });
});
