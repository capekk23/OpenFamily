export interface OpenFamilyClientConfig {
  gatewayUrl: string;
  apiKey: string;
}

export interface InterceptRequest {
  sessionId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  estimatedCost?: number;
}

export type InterceptDecision = 'APPROVED' | 'BLOCKED' | 'DENIED' | 'TIMED_OUT';

export interface InterceptResponse {
  allowed: boolean;
  decision: string;
  reason: string;
  supervisorNotes?: string;
}

export class ToolBlockedError extends Error {
  constructor(
    public readonly decision: string,
    public readonly reason: string,
    public readonly supervisorNotes?: string
  ) {
    super(`Tool blocked: [${decision}] ${reason}`);
    this.name = 'ToolBlockedError';
  }
}

export class OpenFamilyClient {
  private sessionId: string | null = null;

  constructor(private readonly config: OpenFamilyClientConfig) {}

  async startSession(agentId: string, options?: { agentName?: string; policyId?: string }): Promise<string> {
    const response = await fetch(`${this.config.gatewayUrl}/v1/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenFamily-Key': this.config.apiKey,
      },
      body: JSON.stringify({ agentId, ...options }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(`Failed to start session: ${err.error ?? response.statusText}`);
    }

    const data = await response.json() as { sessionId: string };
    this.sessionId = data.sessionId;
    return this.sessionId;
  }

  async intercept(req: InterceptRequest): Promise<InterceptResponse> {
    const response = await fetch(`${this.config.gatewayUrl}/v1/intercept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenFamily-Key': this.config.apiKey,
      },
      body: JSON.stringify(req),
    });

    const data = await response.json() as InterceptResponse;

    if (!response.ok) {
      throw new ToolBlockedError(data.decision, data.reason, data.supervisorNotes);
    }

    return data;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }
}
