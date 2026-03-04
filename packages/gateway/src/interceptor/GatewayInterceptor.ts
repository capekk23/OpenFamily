import { PrismaClient } from '@prisma/client';
import { PolicyChecker } from './PolicyChecker.js';
import { SupervisorClient } from './SupervisorClient.js';
import { ApprovalWaiter } from './ApprovalWaiter.js';
import { PolicyRules } from '@openfamily/policy-engine';

export interface InterceptRequest {
  sessionId: string;
  agentId: string;
  policyId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  estimatedCost?: number;
  spentBudget: number;
  policy: PolicyRules;
}

export type InterceptOutcome =
  | { allowed: true; decision: string; reason: string; supervisorNotes?: string }
  | { allowed: false; decision: string; reason: string; supervisorNotes?: string };

const HUMAN_WAIT_MS = 30_000; // max 30s for human approval via open HTTP connection

export class GatewayInterceptor {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly policyChecker: PolicyChecker,
    private readonly supervisorClient: SupervisorClient,
    private readonly approvalWaiter: ApprovalWaiter
  ) {}

  async intercept(req: InterceptRequest): Promise<InterceptOutcome> {
    const evalResult = await this.policyChecker.check({
      sessionId: req.sessionId,
      agentId: req.agentId,
      toolName: req.toolName,
      toolInput: req.toolInput,
      estimatedCost: req.estimatedCost,
      spentBudget: req.spentBudget,
      policy: req.policy,
    });

    if (evalResult.verdict === 'BLOCK') {
      await this.writeEvent(req, 'BLOCKED', evalResult.reason);
      return { allowed: false, decision: 'BLOCKED', reason: evalResult.reason };
    }

    if (evalResult.verdict === 'APPROVE') {
      await this.writeEvent(req, 'APPROVED', evalResult.reason);
      return { allowed: true, decision: 'APPROVED', reason: evalResult.reason };
    }

    if (evalResult.verdict === 'SUPERVISOR') {
      return this.handleSupervisor(req, evalResult.reason);
    }

    // HUMAN_APPROVAL
    return this.handleHumanApproval(req, evalResult.reason);
  }

  private async handleSupervisor(req: InterceptRequest, reason: string): Promise<InterceptOutcome> {
    const supervisorResult = await this.supervisorClient.evaluate({
      toolName: req.toolName,
      toolInput: req.toolInput,
      sessionId: req.sessionId,
      policyId: req.policyId,
      spentBudget: req.spentBudget,
      policyRules: req.policy,
    });

    if (supervisorResult.decision === 'APPROVE') {
      await this.writeEvent(req, 'APPROVED_BY_SUPERVISOR', reason, true, supervisorResult.notes);
      return {
        allowed: true,
        decision: 'APPROVED_BY_SUPERVISOR',
        reason,
        supervisorNotes: supervisorResult.notes,
      };
    }

    if (supervisorResult.decision === 'ESCALATE_HUMAN') {
      return this.handleHumanApproval(req, supervisorResult.reason, true, supervisorResult.notes);
    }

    await this.writeEvent(req, 'DENIED_BY_SUPERVISOR', supervisorResult.reason, true, supervisorResult.notes);
    return {
      allowed: false,
      decision: 'DENIED_BY_SUPERVISOR',
      reason: supervisorResult.reason,
      supervisorNotes: supervisorResult.notes,
    };
  }

  private async handleHumanApproval(
    req: InterceptRequest,
    reason: string,
    supervisorUsed = false,
    supervisorNotes?: string
  ): Promise<InterceptOutcome> {
    const timeoutSeconds = req.policy.requireApproval?.approvalTimeoutSeconds ?? 300;
    const timeoutBehavior = req.policy.requireApproval?.timeoutBehavior ?? 'deny';

    const expiresAt = new Date(Date.now() + timeoutSeconds * 1000);

    const event = await this.writeEvent(req, 'PENDING_HUMAN', reason, supervisorUsed, supervisorNotes);

    const approval = await this.prisma.approvalRequest.create({
      data: {
        eventId: event.id,
        sessionId: req.sessionId,
        expiresAt,
      },
    });

    const resolution = await this.approvalWaiter.wait(
      approval.id,
      HUMAN_WAIT_MS,
      timeoutBehavior
    );

    const finalDecision =
      resolution.outcome === 'APPROVED_BY_HUMAN' ? 'APPROVED_BY_HUMAN' :
      resolution.outcome === 'DENIED_BY_HUMAN' ? 'DENIED_BY_HUMAN' : 'TIMED_OUT';

    await this.prisma.actionEvent.update({
      where: { id: event.id },
      data: { decision: finalDecision, reason: resolution.reviewNote ?? reason },
    });

    if (resolution.outcome === 'TIMED_OUT') {
      await this.prisma.approvalRequest.update({
        where: { id: approval.id },
        data: { status: 'TIMED_OUT' },
      });
    }

    return {
      allowed: resolution.outcome === 'APPROVED_BY_HUMAN',
      decision: finalDecision,
      reason: resolution.reviewNote ?? reason,
      supervisorNotes,
    };
  }

  private async writeEvent(
    req: InterceptRequest,
    decision: string,
    reason: string,
    supervisorUsed = false,
    supervisorNotes?: string
  ) {
    return this.prisma.actionEvent.create({
      data: {
        sessionId: req.sessionId,
        policyId: req.policyId,
        toolName: req.toolName,
        toolInput: req.toolInput,
        decision: decision as never,
        reason,
        estimatedCost: req.estimatedCost,
        supervisorUsed,
        supervisorNotes,
      },
    });
  }
}
