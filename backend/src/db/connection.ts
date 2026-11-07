import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

const databaseUrl = Deno.env.get('DATABASE_URL');

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Connection pool for production, single connection for dev
const isDev = Deno.env.get('NODE_ENV') !== 'production';
const sql = postgres(databaseUrl, {
  max: isDev ? 1 : 10,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
  onnotice: isDev ? console.log : () => {},
});

export const db = drizzle(sql, { schema });

export async function closeDb() {
  await sql.end();
}

// Health check
export async function checkDbConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// Transaction helper
export async function withTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  return await db.transaction(fn as any);
}