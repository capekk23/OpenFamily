import { z } from 'zod';

export const BudgetCapSchema = z.object({
  maxPerSession: z.number().nonnegative(),
  maxPerCall: z.number().nonnegative(),
});

export const RateLimitsSchema = z.object({
  callsPerMinute: z.number().int().positive(),
  callsPerHour: z.number().int().positive(),
});

export const RequiredApprovalSchema = z.object({
  always: z.boolean().default(false),
  forTools: z.array(z.string()).default([]),
  whenBudgetExceeds: z.number().nonnegative().optional(),
  approvalTimeoutSeconds: z.number().int().positive().default(300),
  timeoutBehavior: z.enum(['approve', 'deny']).default('deny'),
});

export const PolicyRulesSchema = z.object({
  allowedTools: z.array(z.string()).optional(),
  blockedTools: z.array(z.string()).default([]),
  allowedDomains: z.array(z.string()).default([]),
  budgetCap: BudgetCapSchema.optional(),
  rateLimits: RateLimitsSchema.optional(),
  requireApproval: RequiredApprovalSchema.optional(),
  useSupervisor: z.boolean().default(false),
});

export type PolicyRules = z.infer<typeof PolicyRulesSchema>;
export type BudgetCap = z.infer<typeof BudgetCapSchema>;
export type RateLimits = z.infer<typeof RateLimitsSchema>;
export type RequiredApproval = z.infer<typeof RequiredApprovalSchema>;
