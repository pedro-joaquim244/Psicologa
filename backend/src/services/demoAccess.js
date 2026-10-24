import db from '../database.js';
import { publicDemoLoginEnabled } from '../config/runtime.js';
import { createAuthenticatedSession } from './authentication.js';

const profiles = {
  paciente: {
    table: 'pacientes',
    email: () => String(process.env.DEMO_PATIENT_EMAIL || 'paciente.demo@example.invalid').trim().toLowerCase(),
  },
  profissional: {
    table: 'usuarios_admin',
    email: () => String(process.env.DEMO_PROFESSIONAL_EMAIL || 'profissional.demo@example.invalid').trim().toLowerCase(),
  },
};

function failure(status, message) {
  return Object.assign(new Error(message), { status });
}

export async function createDemoSession(kind, database = db) {
  const profile = profiles[kind];
  if (!profile || !publicDemoLoginEnabled()) throw failure(404, 'Acesso demonstrativo indisponível.');
  const [rows] = await database.query(
    `SELECT id, nome, email, ativo, email_verificado_em${kind === 'paciente' ? ', telefone' : ', tipo, profissional_id'}
     FROM ${profile.table}
     WHERE email = ? AND ativo = 1 AND email_verificado_em IS NOT NULL
     LIMIT 1`,
    [profile.email()],
  );
  const user = rows[0];
  if (!user) throw failure(503, 'A conta demonstrativa ainda não foi preparada.');
  return createAuthenticatedSession(kind, user, 'Acesso demonstrativo iniciado com sucesso!');
}
