import postgres from 'postgres';

const databaseUrl = Deno.env.get('DATABASE_URL') || 'postgresql://sonoriafm:sonoriafm_dev_password@localhost:5432/sonoriafm';

const sql = postgres(databaseUrl);

try {
  const migration = await Deno.readTextFile('./migrations/0001_initial_schema.sql');
  await sql.unsafe(migration);
  console.log('✅ Migration completed successfully');
} catch (error) {
  console.error('❌ Migration failed:', error);
} finally {
  await sql.end();
}