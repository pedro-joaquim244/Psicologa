import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Defina DATABASE_URL para executar as migrations PostgreSQL.');

const parsedUrl = new URL(databaseUrl);
const localHosts = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal']);
const isLocal = localHosts.has(parsedUrl.hostname);
if (!isLocal && process.env.ALLOW_REMOTE_MIGRATIONS !== 'true') {
  throw new Error('Migration remota bloqueada. Use um PostgreSQL local ou defina ALLOW_REMOTE_MIGRATIONS=true somente apos autorizacao explicita.');
}

const sslMode = String(process.env.DATABASE_SSL || (isLocal ? 'disable' : 'require')).toLowerCase();
const ssl = ['disable', 'false', '0'].includes(sslMode)
  ? false
  : { rejectUnauthorized: !['require', 'no-verify'].includes(sslMode) };
const client = new pg.Client({ connectionString: databaseUrl, ssl, application_name: 'agenda-migrations' });
const here = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(here, '../../supabase/migrations');

await client.connect();
try {
  await client.query(`create table if not exists public.schema_migrations (
    nome text primary key,
    checksum char(64) not null,
    aplicado_em timestamptz not null default current_timestamp
  )`);
  await client.query('alter table public.schema_migrations enable row level security');

  const files = (await readdir(migrationsDirectory)).filter((name) => name.endsWith('.sql')).sort();
  for (const name of files) {
    const sql = await readFile(resolve(migrationsDirectory, name), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const { rows } = await client.query('select checksum from public.schema_migrations where nome = $1', [name]);
    if (rows[0]?.checksum && rows[0].checksum !== checksum) throw new Error(`A migration ja aplicada foi alterada: ${name}`);
    if (rows.length) {
      console.log(`ignorada ${name}`);
      continue;
    }
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into public.schema_migrations (nome, checksum) values ($1, $2)', [name, checksum]);
      await client.query('commit');
      console.log(`aplicada ${name}`);
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }
} finally {
  await client.end();
}
