import { Request, Response } from 'express';
import Redis from 'ioredis';

const CHANNEL = 'approvals:new';

/**
 * SSE endpoint — streams new approval requests to the dashboard in real time.
 * Gateway publishes to CHANNEL when a HUMAN_APPROVAL is created.
 */
export function createApprovalStreamHandler(redis: Redis) {
  return (_req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    res.write('data: {"type":"connected"}\n\n');

    const subscriber = redis.duplicate();
    subscriber.subscribe(CHANNEL);

    subscriber.on('message', (_channel, message) => {
      res.write(`data: ${message}\n\n`);
    });

    // Heartbeat every 15s to keep connection alive through proxies
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15_000);

    res.on('close', () => {
      clearInterval(heartbeat);
      subscriber.unsubscribe(CHANNEL).catch(() => {});
      subscriber.quit().catch(() => {});
    });
  };
}

export async function publishNewApproval(redis: Redis, payload: unknown): Promise<void> {
  await redis.publish(CHANNEL, JSON.stringify(payload));
}
