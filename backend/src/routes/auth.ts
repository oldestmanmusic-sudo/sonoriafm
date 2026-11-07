import { Hono } from '@hono/hono';
import { zValidator } from '../lib/zvalidator.ts';
import { z } from 'zod';
import { db } from '../db/connection.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { verifyAuth, generateToken, hashPassword, verifyPassword, generateMfaSecret, verifyTotp } from '../middleware/auth.ts';

interface UserContext {
  id: string;
  email: string;
  name: string;
  role: string;
  mfaEnabled: boolean;
  mfaSecret?: string | null;
  passwordHash?: string | null;
}

// Use any to bypass Hono 4.13 strict typing
const authRoute = new Hono<any>();

// POST /auth/register
authRoute.post('/register', zValidator('json', z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
})), async (c) => {
  try {
    const { email, password, name } = c.req.valid('json');

    // Check if user exists
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) {
      return c.json({ error: 'Email already registered' }, 400);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const [user] = await db.insert(users).values({
      email,
      passwordHash,
      name,
      role: 'listener',
    }).returning({ id: users.id, email: users.email, name: users.name, role: users.role });

    if (!user) {
      return c.json({ error: 'Failed to create user' }, 500);
    }

    // Generate token
    const token = await generateToken({ id: user.id, email: user.email, role: user.role });

    return c.json({ user, token }, 201);
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'Registration failed' }, 500);
  }
});

// POST /auth/login
authRoute.post('/login', zValidator('json', z.object({
  email: z.string().email(),
  password: z.string(),
  mfaCode: z.string().length(6).optional(),
})), async (c) => {
  try {
    const { email, password, mfaCode } = c.req.valid('json');

    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user || !user.passwordHash) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Check MFA if enabled
    if (user.mfaEnabled) {
      if (!mfaCode) {
        return c.json({ error: 'MFA required', mfaRequired: true }, 401);
      }
      if (!user.mfaSecret || !(await verifyTotp(user.mfaSecret, mfaCode))) {
        return c.json({ error: 'Invalid MFA code' }, 401);
      }
    }

    const token = await generateToken(user);
    const { passwordHash: _, mfaSecret: __, ...safeUser } = user;

    return c.json({ user: safeUser, token });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Login failed' }, 500);
  }
});

// GET /auth/me - Get current user
authRoute.get('/me', verifyAuth, async (c) => {
  const user = c.get('user') as UserContext;
  const { passwordHash: _, mfaSecret: __, ...safeUser } = user;
  return c.json({ user: safeUser });
});

// POST /auth/mfa/setup - Setup/verify MFA
authRoute.post('/mfa/setup', verifyAuth, zValidator('json', z.object({
  enabled: z.boolean(),
  code: z.string().length(6).optional(),
})), async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const { enabled, code } = c.req.valid('json');

    if (enabled) {
      // Generate new secret if not exists
      let secret = user.mfaSecret;
      if (!secret) {
        secret = generateMfaSecret();
        await db.update(users).set({ mfaSecret: secret }).where(eq(users.id, user.id));
      }

      // Verify code if provided
      if (code) {
        const valid = await verifyTotp(secret, code);
        if (!valid) {
          return c.json({ error: 'Invalid MFA code' }, 400);
        }
        await db.update(users).set({ mfaEnabled: true }).where(eq(users.id, user.id));
        return c.json({ secret, enabled: true });
      }

      // Return secret for QR code generation
      return c.json({ secret, enabled: false });
    } else {
      // Disable MFA
      if (!code) {
        return c.json({ error: 'MFA code required to disable' }, 400);
      }
      if (!user.mfaSecret || !(await verifyTotp(user.mfaSecret, code))) {
        return c.json({ error: 'Invalid MFA code' }, 400);
      }
      await db.update(users).set({ mfaEnabled: false, mfaSecret: null }).where(eq(users.id, user.id));
      return c.json({ enabled: false });
    }
  } catch (error) {
    console.error('MFA setup error:', error);
    return c.json({ error: 'MFA setup failed' }, 500);
  }
});

// POST /auth/forgot-password - Request password reset
authRoute.post('/forgot-password', zValidator('json', z.object({
  email: z.string().email(),
})), async (c) => {
  try {
    const { email } = c.req.valid('json');
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });

    // Always return success to prevent email enumeration
    if (!user) {
      return c.json({ success: true });
    }

    // Generate reset token (in production, send via email)
    const crypto = await import('node:crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Store hashed token with expiry (1 hour)
    await db.update(users).set({
      // We'd need a passwordResetToken and passwordResetExpires field in schema
      // For now, just return the token (in production, email it)
    }).where(eq(users.id, user.id));

    // In production: send email with reset link
    // For dev: return token
    if (Deno.env.get('NODE_ENV') !== 'production') {
      return c.json({ success: true, devResetToken: resetToken });
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Forgot password error:', error);
    return c.json({ error: 'Failed to process request' }, 500);
  }
});

// POST /auth/reset-password - Reset password with token
authRoute.post('/reset-password', zValidator('json', z.object({
  token: z.string(),
  password: z.string().min(8).max(128),
})), async (c) => {
  try {
    const { token, password } = c.req.valid('json');

    // In production: verify token hash from DB
    // For dev: decode token
    const crypto = await import('node:crypto');
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with this token (would need passwordResetToken field)
    // Simplified for now
    return c.json({ error: 'Not fully implemented - needs password reset token fields in schema' }, 501);
  } catch (error) {
    console.error('Reset password error:', error);
    return c.json({ error: 'Failed to reset password' }, 500);
  }
});

// POST /auth/change-password - Change password (authenticated)
authRoute.post('/change-password', verifyAuth, zValidator('json', z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(128),
})), async (c) => {
  try {
    const user = c.get('user') as UserContext;
    const { currentPassword, newPassword } = c.req.valid('json');

    const dbUser = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    if (!dbUser || !dbUser.passwordHash) {
      return c.json({ error: 'User not found' }, 404);
    }

    const valid = await verifyPassword(currentPassword, dbUser.passwordHash);
    if (!valid) {
      return c.json({ error: 'Current password incorrect' }, 400);
    }

    const newHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, user.id));

    return c.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    return c.json({ error: 'Failed to change password' }, 500);
  }
});

// POST /auth/refresh - Refresh token
authRoute.post('/refresh', verifyAuth, async (c) => {
  const user = c.get('user') as UserContext;
  const token = await generateToken(user);
  return c.json({ token });
});

export default authRoute;