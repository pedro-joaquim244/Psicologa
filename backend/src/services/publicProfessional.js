import { demoModeEnabled } from '../config/runtime.js';
import { validId } from '../utils/scheduling.js';

function failure(status, message) {
  return Object.assign(new Error(message), { status });
}

export async function resolvePublicProfessionalId(database, requestedId) {
  const configuredId = requestedId ?? process.env.PUBLIC_PROFESSIONAL_ID;
  if (configuredId !== undefined && configuredId !== null && String(configuredId).trim() !== '') {
    if (!validId(configuredId)) throw failure(400, 'Profissional inválido.');
    return Number(configuredId);
  }

  // Mantém o contrato legado fora da demonstração. No modo demo, o ID não é
  // previsível porque o Supabase preserva a sequência das tabelas.
  if (!demoModeEnabled()) return 1;

  const email = String(process.env.DEMO_PROFESSIONAL_EMAIL || 'profissional.demo@example.invalid').trim().toLowerCase();
  if (!/^[^\s@]+@example\.invalid$/.test(email)) {
    throw failure(503, 'A agenda demonstrativa ainda não está disponível.');
  }
  const [rows] = await database.query(
    `SELECT p.id
     FROM profissionais p
     JOIN usuarios_admin u ON u.profissional_id = p.id
     WHERE LOWER(p.email) = ? AND LOWER(u.email) = ?
       AND p.ativo = 1 AND u.ativo = 1
       AND u.tipo = 'psicologa' AND u.email_verificado_em IS NOT NULL
     ORDER BY p.id
     LIMIT 1`,
    [email, email],
  );
  if (!validId(rows[0]?.id)) {
    throw failure(503, 'A agenda demonstrativa ainda não está disponível.');
  }
  return Number(rows[0].id);
}
