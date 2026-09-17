import 'dotenv/config';
import db from './database.js';
import { ensureCoreSchema } from './services/coreSchema.js';
import { ensurePatientSchema } from './services/patientSchema.js';

// Additive and repeatable: existing appointments remain intact.
try {
  await ensureCoreSchema();
  await ensurePatientSchema();
  console.log('Estrutura de contas de pacientes pronta.');
  console.log('Estrutura de verificação de e-mail pronta.');
} finally {
  await db.end();
}
