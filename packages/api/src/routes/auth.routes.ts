import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export function createAuthRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.post('/login', async (req, res) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    res.json({ accessToken, refreshToken, user: payload });
  });

  router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) {
      res.status(400).json({ error: 'Missing refreshToken' });
      return;
    }

    try {
      const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as {
        userId: string;
        email: string;
        role: string;
      };
      const newPayload = { userId: payload.userId, email: payload.email, role: payload.role };
      const accessToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: '15m' });
      res.json({ accessToken });
    } catch {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
  });

  router.post('/logout', (_req, res) => {
    // Stateless JWT — client clears token
    res.json({ ok: true });
  });

  return router;
}
