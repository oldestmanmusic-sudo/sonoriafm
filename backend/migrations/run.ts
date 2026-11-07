import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, sql } from '../src/db/connection.ts';

async function runMigrations() {
  console.log('Running migrations...');
  try {
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

if (import.meta.main) {
  await runMigrations();
}