import { Hono } from '@hono/hono';
import { cors } from '@hono/hono/cors';
import { logger } from '@hono/hono/logger';
import { prettyJSON } from '@hono/huno/pretty-json';

import authRoute from './routes/auth.ts';
import tracksRoute from './routes/tracks.ts';
import artistsRoute from './routes/artists.ts';
import programsRoute from './routes/programs.ts';
import radioRoute from './routes/radio.ts';
import streamingRoute from './routes/streaming.ts';
import analyticsRoute from './routes/analytics.ts';
import { closeDb } from './db/connection.ts';

// Define app env types for proper typing
interface AppEnv {
  Variables: {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      mfaEnabled: boolean;
    };
    tokenPayload: {
      id: string;
      email: string;
      role: string;
      iat?: number;
      exp?: number;
      [key: string]: any;
    };
  };
}

const app = new Hono<AppEnv>();

// Global middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'https://sonoria.com', 'https://www.sonoria.com'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
}));

// Health check
app.get('/health', async (c) => {
  const dbOk = await (await import('./db/connection.ts')).checkDbConnection();
  return c.json({
    status: dbOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database: dbOk ? 'connected' : 'disconnected',
  });
});

// API routes
app.route('/api/auth', authRoute);
app.route('/api/tracks', tracksRoute);
app.route('/api/artists', artistsRoute);
app.route('/api/programs', programsRoute);
app.route('/api/radio', radioRoute);
app.route('/api/analytics', analyticsRoute);

// Streaming routes (public - no auth required)
app.route('/stream', streamingRoute);

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down...');
  await closeDb();
  Deno.exit(0);
};

Deno.addSignalListener('SIGINT', shutdown);
Deno.addSignalListener('SIGTERM', shutdown);

// Start server
const port = parseInt(Deno.env.get('PORT') || '8000');
console.log(`🚀 SonoriaFM Backend running on http://localhost:${port}`);

Deno.serve({ port }, app.fetch);