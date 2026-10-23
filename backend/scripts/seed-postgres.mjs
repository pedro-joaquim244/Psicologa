import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Defina DATABASE_URL para carregar os dados ficticios.');
const parsedUrl = new URL(databaseUrl);
if (!['localhost', '127.0.0.1', '::1', 'host.docker.internal'].includes(parsedUrl.hostname)) {
  throw new Error('O seed de demonstracao so pode ser executado em PostgreSQL local.');
}
const client = new pg.Client({ connectionString: databaseUrl, ssl: false, application_name: 'agenda-local-seed' });
const here = dirname(fileURLToPath(import.meta.url));
const sql = await readFile(resolve(here, '../../supabase/seed.sql'), 'utf8');
await client.connect();
try {
  await client.query(sql);
  console.log('Dados ficticios locais preparados.');
} finally {
  await client.end();
}
