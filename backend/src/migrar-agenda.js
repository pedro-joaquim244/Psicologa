import db from './database.js';
import { ensureAgendaSchema } from './services/agendaSchema.js';

try {
  await ensureAgendaSchema();
  console.log('Estrutura de horários recorrentes e extras pronta. Dados existentes preservados.');
} finally {
  await db.end();
}
