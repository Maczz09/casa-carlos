import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

function hash(secret: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(secret, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

function verify(secret: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(secret, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const hashPassword = hash;
export const verifyPassword = verify;
export const hashPin = hash;
export const verifyPin = verify;

export function newToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Tokens already carry 256 bits of entropy from `newToken()`, so a fast hash
 * is enough here — scrypt's cost is for low-entropy secrets like passwords
 * and PINs, and would needlessly slow down every authenticated request.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
