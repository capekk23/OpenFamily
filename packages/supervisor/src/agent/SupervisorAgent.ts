import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, buildEvaluationPrompt } from './prompts/system.prompt.js';
import { logger } from '../logger.js';

export type SupervisorDecision = 'APPROVE' | 'DENY' | 'ESCALATE_HUMAN';

export interface SupervisorResult {
  decision: SupervisorDecision;
  reason: string;
  notes?: string;
}

export interface EvaluateRequest {
  toolName: string;
  toolInput: unknown;
  sessionId: string;
  policyId: string;
  spentBudget: number;
  policyRules: unknown;
}

const approveAction: Anthropic.Tool = {
  name: 'approve_action',
  description: 'Approve the agent tool call as safe and within policy',
  input_schema: {
    type: 'object' as const,
    properties: {
      reason: { type: 'string', description: 'Why this action is approved' },
    },
    required: ['reason'],
  },
};

const denyAction: Anthropic.Tool = {
  name: 'deny_action',
  description: 'Deny the agent tool call as unsafe or policy-violating',
  input_schema: {
    type: 'object' as const,
    properties: {
      reason: { type: 'string', description: 'Why this action is denied' },
    },
    required: ['reason'],
  },
};

const escalateToHuman: Anthropic.Tool = {
  name: 'escalate_to_human',
  description: 'Escalate to a human reviewer when uncertain or the action is high-risk',
  input_schema: {
    type: 'object' as const,
    properties: {
      reason: { type: 'string', description: 'Why human review is needed' },
      notes: { type: 'string', description: 'Additional context for the human reviewer' },
    },
    required: ['reason'],
  },
};

export class SupervisorAgent {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
  }

  async evaluate(req: EvaluateRequest): Promise<SupervisorResult> {
    const log = logger.child({ sessionId: req.sessionId, toolName: req.toolName });
    log.info('supervisor evaluating tool call');
    const prompt = buildEvaluationPrompt(req);

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [approveAction, denyAction, escalateToHuman],
      messages: [{ role: 'user', content: prompt }],
    });

    // Find the tool_use block
    const toolUse = response.content.find((block) => block.type === 'tool_use');

    if (!toolUse || toolUse.type !== 'tool_use') {
      // Fallback: if model returns no tool use, escalate (safe default)
      return {
        decision: 'ESCALATE_HUMAN',
        reason: 'Supervisor did not return a tool call — escalating for safety',
      };
    }

    const input = toolUse.input as { reason: string; notes?: string };
    log.info({ decision: toolUse.name, reason: input.reason }, 'supervisor decision');

    switch (toolUse.name) {
      case 'approve_action':
        return { decision: 'APPROVE', reason: input.reason };
      case 'deny_action':
        return { decision: 'DENY', reason: input.reason };
      case 'escalate_to_human':
        return { decision: 'ESCALATE_HUMAN', reason: input.reason, notes: input.notes };
      default:
        return {
          decision: 'ESCALATE_HUMAN',
          reason: `Unknown tool "${toolUse.name}" — escalating for safety`,
        };
    }
  }
}
