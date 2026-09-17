import { createApp } from './app.js';
import { ensureCoreSchema } from './services/coreSchema.js';
import { ensurePatientSchema } from './services/patientSchema.js';
import { ensureAgendaSchema } from './services/agendaSchema.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'configure-um-segredo-longo-e-aleatorio' || Buffer.byteLength(process.env.JWT_SECRET, 'utf8') < 32) {
  throw new Error('Configure JWT_SECRET com ao menos 32 bytes aleatorios no ambiente do backend antes de iniciar a API.');
}
const app = createApp();
const PORT = process.env.PORT || 3333;

async function startServer() {
  // Do not expose routes backed by a partially migrated schema. These
  // operations are additive and make fresh installations usable as well.
  await ensureCoreSchema();
  await ensurePatientSchema();
  await ensureAgendaSchema();
  app.listen(PORT, () => console.log('API rodando na porta ' + PORT));
}

startServer().catch((error) => {
  console.error('A API não pôde preparar o schema do banco:', error);
  process.exitCode = 1;
});
export default app;
