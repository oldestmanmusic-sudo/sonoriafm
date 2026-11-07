import postgres from 'postgres';

const sql = postgres('postgresql://sonoriafm:sonoriafm_dev_password@localhost:5432/sonoriafm');

const count = await sql`SELECT COUNT(*) FROM tracks`;
console.log('Tracks in DB:', count);

const tracks = await sql`SELECT id, title, artist_id, audio_url FROM tracks LIMIT 5`;
console.log('Sample tracks:', tracks);

await sql.end();