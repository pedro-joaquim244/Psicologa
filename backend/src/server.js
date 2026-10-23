import { createApp } from './app.js';
import { ensureCoreSchema } from './services/coreSchema.js';
import { ensurePatientSchema } from './services/patientSchema.js';
import { ensureAgendaSchema } from './services/agendaSchema.js';
import { appointmentNotifications } from './services/appointmentNotifications.js';
import db from './database.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'configure-um-segredo-longo-e-aleatorio' || Buffer.byteLength(process.env.JWT_SECRET, 'utf8') < 32) {
  throw new Error('Configure JWT_SECRET com ao menos 32 bytes aleatorios no ambiente do backend antes de iniciar a API.');
}
const app = createApp();
const PORT = process.env.PORT || 3333;
let httpServer;
let notificationRetryTimer;

async function startServer() {
  // Do not expose routes backed by a partially migrated schema. These
  // operations are MySQL-only. PostgreSQL is changed exclusively through the
  // versioned files in supabase/migrations; the API never mutates that schema.
  if (db.dialect === 'mysql') {
    await ensureCoreSchema();
    await ensurePatientSchema();
    await ensureAgendaSchema();
  }
  httpServer = app.listen(PORT, '0.0.0.0', () => console.log('API rodando na porta ' + PORT));
  const retryInterval = Math.max(60_000, Number(process.env.NOTIFICATION_RETRY_INTERVAL_MS || 300_000));
  const retry = () => appointmentNotifications.retryDue().catch(() => console.error('Falha ao processar notificações pendentes.'));
  retry();
  notificationRetryTimer = setInterval(retry, retryInterval);
  notificationRetryTimer.unref();
}

async function shutdown(signal) {
  if (!httpServer) return;
  console.log(`Encerrando API após ${signal}.`);
  if (notificationRetryTimer) clearInterval(notificationRetryTimer);
  const server = httpServer;
  httpServer = undefined;
  const forceClose = setTimeout(() => {
    server.closeAllConnections();
    process.exitCode = 1;
  }, 10_000);
  forceClose.unref();
  server.close(async (error) => {
    clearTimeout(forceClose);
    try {
      await db.end();
    } catch {
      process.exitCode = 1;
    }
    if (error) process.exitCode = 1;
  });
}

process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
process.once('SIGINT', () => { void shutdown('SIGINT'); });

startServer().catch((error) => {
  console.error('A API não pôde preparar o schema do banco:', error);
  process.exitCode = 1;
});
export default app;
