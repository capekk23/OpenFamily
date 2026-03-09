import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALG = 'aes-256-gcm';

function getKey(): Buffer {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? 'insecure-dev-key-change-in-production';
  // Derive a 32-byte key via simple SHA-256 hash of the secret
  const { createHash } = require('crypto') as typeof import('crypto');
  return createHash('sha256').update(secret).digest();
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(12):tag(16):ciphertext — all hex-encoded, colon-separated
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(stored: string): string {
  const key = getKey();
  const [ivHex, tagHex, ciphertextHex] = stored.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}
