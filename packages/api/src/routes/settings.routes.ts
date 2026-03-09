import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { encrypt, decrypt } from '../lib/crypto.js';

export function createSettingsRouter(prisma: PrismaClient): Router {
  const router = Router();
  router.use(requireAuth);

  // GET /api/settings/providers — list all provider configs (keys redacted)
  router.get('/providers', async (_req, res) => {
    const settings = await prisma.setting.findMany({
      where: { key: { startsWith: 'provider.' } },
    });
    const result: Record<string, unknown> = {};
    for (const s of settings) {
      const providerId = s.key.replace('provider.', '');
      const parsed = JSON.parse(s.value) as Record<string, unknown>;
      // Redact the apiKey field so it's never sent to the browser
      if (parsed.apiKey) parsed.apiKey = '••••••••';
      result[providerId] = parsed;
    }
    res.json(result);
  });

  // PUT /api/settings/providers/:provider — upsert a provider config (admin only)
  router.put('/providers/:provider', requireRole('ADMIN'), async (req, res) => {
    const schema = z.object({
      apiKey: z.string().min(1).optional(),
      baseUrl: z.string().url().optional(),
      model: z.string().min(1).optional(),
      enabled: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const providerId = String(req.params.provider);
    const key = `provider.${providerId}`;

    // Merge with existing config (so partial updates work)
    const existing = await prisma.setting.findUnique({ where: { key } });
    let current: Record<string, unknown> = {};
    if (existing) {
      const raw = existing.encrypted ? decrypt(existing.value) : existing.value;
      current = JSON.parse(raw) as Record<string, unknown>;
    }

    // Merge — only overwrite fields that were sent
    const updated = { ...current };
    if (parsed.data.apiKey !== undefined) updated.apiKey = parsed.data.apiKey;
    if (parsed.data.baseUrl !== undefined) updated.baseUrl = parsed.data.baseUrl;
    if (parsed.data.model !== undefined) updated.model = parsed.data.model;
    if (parsed.data.enabled !== undefined) updated.enabled = parsed.data.enabled;

    const plaintext = JSON.stringify(updated);
    const storedValue = encrypt(plaintext);

    await prisma.setting.upsert({
      where: { key },
      update: { value: storedValue, encrypted: true },
      create: { key, value: storedValue, encrypted: true },
    });

    res.json({ ok: true, provider: providerId });
  });

  // DELETE /api/settings/providers/:provider (admin only)
  router.delete('/providers/:provider', requireRole('ADMIN'), async (req, res) => {
    const key = `provider.${String(req.params.provider)}`;
    await prisma.setting.deleteMany({ where: { key } });
    res.json({ ok: true });
  });

  // GET /api/settings/setup-status — is first-run setup complete?
  router.get('/setup-status', async (_req, res) => {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    const hasProvider = await prisma.setting.findFirst({ where: { key: { startsWith: 'provider.' } } });
    res.json({ hasAdmin: adminCount > 0, hasProvider: !!hasProvider, ready: adminCount > 0 && !!hasProvider });
  });

  return router;
}
