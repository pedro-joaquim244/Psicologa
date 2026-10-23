import 'dotenv/config';
import { spawnSync } from 'node:child_process';

const dialect = String(process.env.DB_CLIENT || (process.env.DATABASE_URL ? 'postgres' : 'mysql')).toLowerCase();
if (dialect === 'postgres') {
  await import('./migrate-postgres.mjs');
} else if (dialect === 'mysql') {
  for (const script of ['src/migrar-pacientes.js', 'src/migrar-agenda.js']) {
    const result = spawnSync(process.execPath, [script], { stdio: 'inherit', env: process.env });
    if (result.status !== 0) process.exit(result.status || 1);
  }
} else {
  throw new Error('DB_CLIENT deve ser "mysql" ou "postgres".');
}
