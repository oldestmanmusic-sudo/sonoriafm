import { verify, sign } from '@hono/hono/jwt';
import { db } from '../db/connection.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

// JWT secret - should be in env
const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'dev-secret-change-in-production';
const JWT_EXPIRY = '7d'; // 7 days

export interface UserPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
  [key: string]: any;
}

// Middleware to verify JWT and attach user
export const verifyAuth = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized - No token provided' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verify(token, JWT_SECRET, 'HS256') as unknown as UserPayload;

    // Fetch user from DB to ensure they still exist and get latest role
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.id),
      columns: { id: true, email: true, name: true, role: true, mfaEnabled: true },
    });

    if (!user) {
      return c.json({ error: 'Unauthorized - User not found' }, 401);
    }

    c.set('user', user);
    c.set('tokenPayload', payload);
    await next();
  } catch (error: any) {
    if (error.name === 'JwtTokenExpired') {
      return c.json({ error: 'Unauthorized - Token expired' }, 401);
    }
    return c.json({ error: 'Unauthorized - Invalid token' }, 401);
  }
};

// Middleware to require admin role
export const requireAdmin = async (c: any, next: any) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden - Admin access required' }, 403);
  }
  await next();
};

// Middleware to require artist role (or admin)
export const requireArtist = async (c: any, next: any) => {
  const user = c.get('user');
  if (!user || (user.role !== 'artist' && user.role !== 'admin')) {
    return c.json({ error: 'Forbidden - Artist access required' }, 403);
  }
  await next();
};

// Optional auth - doesn't fail if no token
export const optionalAuth = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await next();
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verify(token, JWT_SECRET, 'HS256') as unknown as UserPayload;
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.id),
      columns: { id: true, email: true, name: true, role: true },
    });
    if (user) {
      c.set('user', user);
    }
  } catch {
    // Ignore invalid tokens for optional auth
  }
  await next();
};

// Generate JWT token
export async function generateToken(user: { id: string; email: string; role: string }): Promise<string> {
  const payload: UserPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
  };
  return await sign(payload, JWT_SECRET, 'HS256');
}

// Verify password (using bcrypt)
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import('npm:bcrypt@^5.1.0');
  return bcrypt.default.compare(password, hash);
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('npm:bcrypt@^5.1.0');
  return bcrypt.default.hash(password, 12);
}

// Generate MFA secret (base32)
export function generateMfaSecret(): string {
  const array = new Uint8Array(20);
  crypto.getRandomValues(array);
  return base32Encode(array);
}

function base32Encode(buffer: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

// Verify TOTP code
export async function verifyTotp(secret: string, token: string, window: number = 1): Promise<boolean> {
  const timeStep = Math.floor(Date.now() / 1000 / 30);
  const base32 = await import('npm:base32-decode@^1.0.0');

  for (let i = -window; i <= window; i++) {
    const expected = await generateTotp(secret, timeStep + i);
    if (expected === token) return true;
  }
  return false;
}

async function generateTotp(secret: string, timeStep: number): Promise<string> {
  const crypto = await import('node:crypto');
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(timeStep));

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(counter);
  const hash = hmac.digest();

  const lastByte = hash[hash.length - 1];
  if (lastByte === undefined) return '000000';
  const offset = lastByte & 0xf;
  const byte0 = hash[offset] ?? 0;
  const byte1 = hash[offset + 1] ?? 0;
  const byte2 = hash[offset + 2] ?? 0;
  const byte3 = hash[offset + 3] ?? 0;
  const code = ((byte0 & 0x7f) << 24) |
    ((byte1 & 0xff) << 16) |
    ((byte2 & 0xff) << 8) |
    (byte3 & 0xff);

  return (code % 1000000).toString().padStart(6, '0');
}

function base32Decode(str: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of str.toUpperCase()) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    const byte = bits.slice(i, i + 8);
    if (byte.length === 8) bytes.push(parseInt(byte, 2));
  }
  return Buffer.from(bytes);
}

export { JWT_SECRET };