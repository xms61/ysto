// Opaque random tokens: 256 bits in base64url, for clip tokens and the session tokens M4 adds
// (docs/SECURITY.md). One definition, so every route checks the same shape.
import { randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export function newToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function isToken(value: string): boolean {
  return TOKEN_SHAPE.test(value);
}
