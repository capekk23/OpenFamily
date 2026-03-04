import { OpenFamilyClient, InterceptResponse } from '../OpenFamilyClient.js';

/**
 * Raw HTTP adapter for frameworks that don't have a dedicated adapter.
 * Provides a simple intercept function that returns the decision.
 */
export async function intercept(
  client: OpenFamilyClient,
  sessionId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  options?: { estimatedCost?: number }
): Promise<InterceptResponse> {
  return client.intercept({ sessionId, toolName, toolInput, ...options });
}
