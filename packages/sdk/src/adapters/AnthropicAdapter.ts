import { OpenFamilyClient, ToolBlockedError } from '../OpenFamilyClient.js';

export interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface InterceptedToolResult {
  toolUseId: string;
  toolName: string;
  allowed: boolean;
  decision: string;
  reason: string;
}

/**
 * Intercepts Anthropic tool_use blocks before execution.
 * Returns an array of results — one per tool call in the message.
 */
export async function interceptToolUseBlocks(
  client: OpenFamilyClient,
  blocks: AnthropicToolUseBlock[],
  sessionId: string
): Promise<InterceptedToolResult[]> {
  return Promise.all(
    blocks.map(async (block) => {
      try {
        const result = await client.intercept({
          sessionId,
          toolName: block.name,
          toolInput: block.input,
        });
        return {
          toolUseId: block.id,
          toolName: block.name,
          allowed: result.allowed,
          decision: result.decision,
          reason: result.reason,
        };
      } catch (err) {
        if (err instanceof ToolBlockedError) {
          return {
            toolUseId: block.id,
            toolName: block.name,
            allowed: false,
            decision: err.decision,
            reason: err.reason,
          };
        }
        throw err;
      }
    })
  );
}
