import db from './database.js';
import { ensureCoreSchema } from './services/coreSchema.js';
import { ensureAgendaSchema } from './services/agendaSchema.js';

if (db.dialect !== 'mysql') {
  throw new Error('Esta migration e exclusiva do MySQL. Use npm run migrate:postgres.');
}

try {
  await ensureCoreSchema();
  await ensureAgendaSchema();
  console.log('Estrutura de horários recorrentes, extras e bloqueios semanais pronta. Dados existentes preservados.');
} finally {
  await db.end();
}
