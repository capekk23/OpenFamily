import { OpenFamilyClient, ToolBlockedError } from '../OpenFamilyClient.js';

/**
 * Minimal interface compatible with LangChain BaseTool to avoid requiring
 * the full @langchain/core package as a hard dependency.
 */
export interface LangChainToolLike {
  name: string;
  description: string;
  func: (input: string | Record<string, unknown>) => Promise<string>;
  [key: string]: unknown;
}

/**
 * Wraps a LangChain-compatible tool so every call is intercepted by OpenFamily.
 * If the call is blocked/denied, throws ToolBlockedError — LangChain will catch it.
 *
 * @example
 * const tools = [webSearch, fileRead].map(t => wrapTool(t, client));
 */
export function wrapTool(tool: LangChainToolLike, client: OpenFamilyClient): LangChainToolLike {
  const originalFunc = tool.func.bind(tool);

  return {
    ...tool,
    func: async (input: string | Record<string, unknown>): Promise<string> => {
      const sessionId = client.getSessionId();
      if (!sessionId) {
        throw new Error('OpenFamilyClient has no active session. Call startSession() first.');
      }

      const toolInput: Record<string, unknown> =
        typeof input === 'string' ? { input } : input;

      // This will throw ToolBlockedError if not allowed
      await client.intercept({ sessionId, toolName: tool.name, toolInput });

      // Approved — delegate to original tool
      return originalFunc(input);
    },
  };
}
