import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, keyLength) as Buffer;
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith('scrypt$')) {
    const parts = stored.split('$');
    if (parts.length !== 3 || !/^[0-9a-f]{32}$/.test(parts[1]) || !/^[0-9a-f]{128}$/.test(parts[2])) return false;
    const actual = await scrypt(password, parts[1], keyLength) as Buffer;
    return timingSafeEqual(actual, Buffer.from(parts[2], 'hex'));
  }
  // Contas antigas usam texto puro. Migramos a senha após um login válido.
  const candidate = createHash('sha256').update(password).digest();
  const legacy = createHash('sha256').update(stored).digest();
  return timingSafeEqual(candidate, legacy);
}

export function isLegacyPassword(stored: string) {
  return !stored.startsWith('scrypt$');
}
