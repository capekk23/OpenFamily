import Redis from 'ioredis';

export type ApprovalOutcome = 'APPROVED_BY_HUMAN' | 'DENIED_BY_HUMAN' | 'TIMED_OUT';

export interface ApprovalResolution {
  outcome: ApprovalOutcome;
  reviewNote?: string;
  resolvedBy?: string;
}

const CHANNEL_PREFIX = 'approvals:resolved:';

export class ApprovalWaiter {
  constructor(private readonly redis: Redis) {}

  /**
   * Wait for a human to resolve an approval request.
   * Returns when the approval is resolved OR when timeoutMs elapses.
   */
  async wait(
    approvalId: string,
    timeoutMs: number,
    timeoutBehavior: 'approve' | 'deny'
  ): Promise<ApprovalResolution> {
    return new Promise((resolve) => {
      const channel = `${CHANNEL_PREFIX}${approvalId}`;
      const subscriber = this.redis.duplicate();

      let settled = false;

      const cleanup = () => {
        subscriber.unsubscribe(channel).catch(() => {});
        subscriber.quit().catch(() => {});
      };

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({
          outcome: timeoutBehavior === 'approve' ? 'APPROVED_BY_HUMAN' : 'TIMED_OUT',
          reviewNote: `Timed out after ${timeoutMs}ms — ${timeoutBehavior}d by policy`,
        });
      }, timeoutMs);

      subscriber.subscribe(channel, (err) => {
        if (err) {
          clearTimeout(timer);
          settled = true;
          cleanup();
          resolve({
            outcome: 'TIMED_OUT',
            reviewNote: 'Redis subscription error',
          });
        }
      });

      subscriber.on('message', (_channel, message) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();

        try {
          const payload = JSON.parse(message) as ApprovalResolution;
          resolve(payload);
        } catch {
          resolve({ outcome: 'DENIED_BY_HUMAN', reviewNote: 'Malformed resolution payload' });
        }
      });
    });
  }

  /**
   * Publish a resolution for an approval (called by the API service).
   */
  static async publish(
    redis: Redis,
    approvalId: string,
    resolution: ApprovalResolution
  ): Promise<void> {
    await redis.publish(
      `${CHANNEL_PREFIX}${approvalId}`,
      JSON.stringify(resolution)
    );
  }
}
