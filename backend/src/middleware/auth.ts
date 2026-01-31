import { Context, Next } from 'hono';
import { verifyToken } from '@clerk/backend';

export interface AuthContext {
  userId: string;
  sessionId: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid authorization header' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    if (!payload.sub) {
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    c.set('auth', { userId: payload.sub, sessionId: payload.sid || '' });
    await next();
  } catch (error) {
    console.error('Auth error:', error);
    return c.json({ error: 'Unauthorized: Token verification failed' }, 401);
  }
}
