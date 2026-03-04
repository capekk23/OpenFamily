import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupervisorAgent } from '../agent/SupervisorAgent.js';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
    __mockCreate: mockCreate,
  };
});

const BASE_REQUEST = {
  toolName: 'web_search',
  toolInput: { query: 'test' },
  sessionId: 'sess-1',
  policyId: 'policy-1',
  spentBudget: 0,
  policyRules: { blockedTools: [], allowedDomains: [], useSupervisor: true },
};

function mockToolUseResponse(toolName: string, input: Record<string, string>) {
  return {
    content: [
      {
        type: 'tool_use',
        id: 'tu_1',
        name: toolName,
        input,
      },
    ],
    stop_reason: 'tool_use',
  };
}

async function getCreateMock() {
  const mod = await import('@anthropic-ai/sdk') as { __mockCreate: ReturnType<typeof vi.fn> };
  return mod.__mockCreate;
}

describe('SupervisorAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns APPROVE when model calls approve_action', async () => {
    const mockCreate = await getCreateMock();
    mockCreate.mockResolvedValue(
      mockToolUseResponse('approve_action', { reason: 'Safe search query' })
    );

    const agent = new SupervisorAgent('test-key');
    const result = await agent.evaluate(BASE_REQUEST);

    expect(result.decision).toBe('APPROVE');
    expect(result.reason).toBe('Safe search query');
  });

  it('returns DENY when model calls deny_action', async () => {
    const mockCreate = await getCreateMock();
    mockCreate.mockResolvedValue(
      mockToolUseResponse('deny_action', { reason: 'Malicious content detected' })
    );

    const agent = new SupervisorAgent('test-key');
    const result = await agent.evaluate(BASE_REQUEST);

    expect(result.decision).toBe('DENY');
    expect(result.reason).toBe('Malicious content detected');
  });

  it('returns ESCALATE_HUMAN when model calls escalate_to_human', async () => {
    const mockCreate = await getCreateMock();
    mockCreate.mockResolvedValue(
      mockToolUseResponse('escalate_to_human', {
        reason: 'Uncertain intent',
        notes: 'Check if user authorized this',
      })
    );

    const agent = new SupervisorAgent('test-key');
    const result = await agent.evaluate(BASE_REQUEST);

    expect(result.decision).toBe('ESCALATE_HUMAN');
    expect(result.reason).toBe('Uncertain intent');
    expect(result.notes).toBe('Check if user authorized this');
  });

  it('falls back to ESCALATE_HUMAN when model returns no tool_use', async () => {
    const mockCreate = await getCreateMock();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'I am unsure what to do here.' }],
      stop_reason: 'end_turn',
    });

    const agent = new SupervisorAgent('test-key');
    const result = await agent.evaluate(BASE_REQUEST);

    expect(result.decision).toBe('ESCALATE_HUMAN');
    expect(result.reason).toContain('Supervisor did not return a tool call');
  });

  it('falls back to ESCALATE_HUMAN on unknown tool name', async () => {
    const mockCreate = await getCreateMock();
    mockCreate.mockResolvedValue(
      mockToolUseResponse('unknown_tool', { reason: 'whatever' })
    );

    const agent = new SupervisorAgent('test-key');
    const result = await agent.evaluate(BASE_REQUEST);

    expect(result.decision).toBe('ESCALATE_HUMAN');
    expect(result.reason).toContain('Unknown tool');
  });

  it('calls Anthropic with claude-sonnet-4-6 model', async () => {
    const mockCreate = await getCreateMock();
    mockCreate.mockResolvedValue(
      mockToolUseResponse('approve_action', { reason: 'ok' })
    );

    const agent = new SupervisorAgent('test-key');
    await agent.evaluate(BASE_REQUEST);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-4-6' })
    );
  });

  it('includes all 3 tools in the request', async () => {
    const mockCreate = await getCreateMock();
    mockCreate.mockResolvedValue(
      mockToolUseResponse('approve_action', { reason: 'ok' })
    );

    const agent = new SupervisorAgent('test-key');
    await agent.evaluate(BASE_REQUEST);

    const [callArgs] = mockCreate.mock.calls;
    const toolNames = (callArgs as [{ tools: { name: string }[] }])[0].tools.map((t) => t.name);
    expect(toolNames).toContain('approve_action');
    expect(toolNames).toContain('deny_action');
    expect(toolNames).toContain('escalate_to_human');
  });
});
