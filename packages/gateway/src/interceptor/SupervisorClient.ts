export type SupervisorDecision = 'APPROVE' | 'DENY' | 'ESCALATE_HUMAN';

export interface SupervisorResult {
  decision: SupervisorDecision;
  reason: string;
  notes?: string;
}

export interface SupervisorRequest {
  toolName: string;
  toolInput: Record<string, unknown>;
  sessionId: string;
  policyId: string;
  spentBudget: number;
  policyRules: unknown;
}

export class SupervisorClient {
  constructor(private readonly supervisorUrl: string) {}

  async evaluate(req: SupervisorRequest): Promise<SupervisorResult> {
    const response = await fetch(`${this.supervisorUrl}/v1/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      // Default to escalate on supervisor failure — safe default
      return {
        decision: 'ESCALATE_HUMAN',
        reason: `Supervisor service unavailable (${response.status})`,
      };
    }

    return response.json() as Promise<SupervisorResult>;
  }
}
