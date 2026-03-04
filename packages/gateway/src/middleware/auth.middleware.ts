import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      apiKey?: { id: string; policyId: string; keyHash: string };
    }
  }
}

export function createAuthMiddleware(prisma: PrismaClient) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const rawKey = req.headers['x-openfamily-key'];
    if (!rawKey || typeof rawKey !== 'string') {
      res.status(401).json({ error: 'Missing X-OpenFamily-Key header' });
      return;
    }

    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash, isActive: true },
      select: { id: true, policyId: true, keyHash: true },
    });

    if (!apiKey) {
      res.status(401).json({ error: 'Invalid or inactive API key' });
      return;
    }

    // Update lastUsedAt without blocking
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    req.apiKey = apiKey;
    next();
  };
}
