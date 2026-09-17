import db from './database.js';
import { ensureCoreSchema } from './services/coreSchema.js';
import { ensureAgendaSchema } from './services/agendaSchema.js';

try {
  await ensureCoreSchema();
  await ensureAgendaSchema();
  console.log('Estrutura de horários recorrentes, extras e bloqueios semanais pronta. Dados existentes preservados.');
} finally {
  await db.end();
}
