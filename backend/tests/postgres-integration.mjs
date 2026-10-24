import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

if (process.env.ALLOW_REMOTE_TEST_WRITES !== 'true') {
  throw new Error('Defina ALLOW_REMOTE_TEST_WRITES=true somente para executar fixtures ficticios isolados.');
}

// The integration test must never contact an e-mail provider. Notification
// failures are persisted and exercised with a deliberately invalid provider.
process.env.EMAIL_PROVIDER = 'integration-test-disabled';

const [{ default: db }, { createApp }, { createEmailVerification }] = await Promise.all([
  import('../src/database.js'),
  import('../src/app.js'),
  import('../src/services/emailVerification.js'),
]);

if (db.dialect !== 'postgres') throw new Error('Este teste exige DB_CLIENT=postgres.');

const runId = randomUUID();
const marker = `codex-pg-${runId}`;
const password = randomBytes(24).toString('base64url');
const previousDemoMode = process.env.DEMO_MODE;
const previousDemoProfessionalEmail = process.env.DEMO_PROFESSIONAL_EMAIL;
const previousPublicProfessionalId = process.env.PUBLIC_PROFESSIONAL_ID;
const ids = { professional: null, admin: null, patients: [], availability: [], appointments: [], blocks: [], emails: [] };
const results = {};
let server;

function futureDate(days = 45) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function request(origin, path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${origin}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  return { status: response.status, data };
}

async function insertFixture() {
  const hash = await bcrypt.hash(password, 12);
  const professionalEmail = `${marker}-profissional@example.invalid`;
  const patientAEmail = `${marker}-paciente-a@example.invalid`;
  const patientBEmail = `${marker}-paciente-b@example.invalid`;
  ids.emails.push(professionalEmail, patientAEmail, patientBEmail);

  const [professional] = await db.query(
    'INSERT INTO profissionais (nome, email, telefone, ativo) VALUES (?, ?, ?, 1)',
    ['Profissional de Integracao', professionalEmail, '11000000000'],
  );
  ids.professional = professional.insertId;

  const [admin] = await db.query(
    `INSERT INTO usuarios_admin
      (nome, email, senha, tipo, ativo, email_verificado_em, profissional_id)
     VALUES (?, ?, ?, 'psicologa', 1, CURRENT_TIMESTAMP, ?)`,
    ['Profissional de Integracao', professionalEmail, hash, ids.professional],
  );
  ids.admin = admin.insertId;

  const [patientA] = await db.query(
    'INSERT INTO pacientes (nome, email, telefone, senha, ativo) VALUES (?, ?, ?, ?, 1)',
    ['Paciente A de Integracao', patientAEmail, '11900000001', hash],
  );
  ids.patients.push(patientA.insertId);
  const [patientB] = await db.query(
    `INSERT INTO pacientes
      (nome, email, telefone, senha, ativo, email_verificado_em)
     VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
    ['Paciente B de Integracao', patientBEmail, '11900000002', hash],
  );
  ids.patients.push(patientB.insertId);

  let verificationCode;
  const verification = createEmailVerification({
    database: db,
    send: async (_email, code) => { verificationCode = code; },
    deliveryAvailable: () => true,
  });
  const challenge = await verification.issue('paciente', patientA.insertId);
  const verifiedSession = await verification.verify('paciente', challenge.desafio, verificationCode);
  assert.equal(verifiedSession.usuario.email_verificado, true);
  results.emailVerification = 'ok';

  const date = futureDate();
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const [availability] = await db.query(
    `INSERT INTO disponibilidades
      (profissional_id, dia_semana, data_especifica, hora_inicio, hora_fim, duracao_minutos, intervalo_minutos, ativo)
     VALUES (?, ?, ?, '09:00', '12:00', 50, 10, 1)`,
    [ids.professional, weekday, date],
  );
  ids.availability.push(availability.insertId);
  return { date, professionalEmail, patientAEmail, patientBEmail };
}

async function waitForNotificationClaims() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const [rows] = await db.query(
      `SELECT COUNT(*)::bigint AS total
       FROM notificacoes_agendamento n
       JOIN agendamentos a ON a.id = n.agendamento_id
       WHERE a.profissional_id = ? AND n.status = 'enviando'`,
      [ids.professional],
    );
    if (Number(rows[0].total) === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function cleanup() {
  if (ids.professional) {
    await waitForNotificationClaims().catch(() => {});
    await db.query('DELETE FROM agendamentos WHERE profissional_id = ?', [ids.professional]);
    await db.query('DELETE FROM bloqueios_agenda WHERE profissional_id = ?', [ids.professional]);
    await db.query('DELETE FROM disponibilidades WHERE profissional_id = ?', [ids.professional]);
  }
  for (const patientId of ids.patients) {
    await db.query("DELETE FROM verificacoes_email WHERE perfil = 'paciente' AND usuario_id = ?", [patientId]);
    await db.query('DELETE FROM pacientes WHERE id = ?', [patientId]);
  }
  if (ids.admin) {
    await db.query("DELETE FROM verificacoes_email WHERE perfil = 'profissional' AND usuario_id = ?", [ids.admin]);
    await db.query('DELETE FROM usuarios_admin WHERE id = ?', [ids.admin]);
  }
  if (ids.professional) await db.query('DELETE FROM profissionais WHERE id = ?', [ids.professional]);
  // Exact e-mail fallbacks also remove a partially inserted fixture when a
  // failure happens before its generated ID reaches this process.
  for (const email of ids.emails) {
    await db.query('DELETE FROM usuarios_admin WHERE email = ?', [email]);
    await db.query('DELETE FROM pacientes WHERE email = ?', [email]);
    await db.query('DELETE FROM profissionais WHERE email = ?', [email]);
  }
}

try {
  const fixture = await insertFixture();
  process.env.DEMO_MODE = 'true';
  process.env.DEMO_PROFESSIONAL_EMAIL = fixture.professionalEmail;
  delete process.env.PUBLIC_PROFESSIONAL_ID;
  const app = createApp({ production: false });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;

  const patientALogin = await request(origin, '/pacientes/login', { method: 'POST', body: { email: fixture.patientAEmail, senha: password } });
  const patientBLogin = await request(origin, '/pacientes/login', { method: 'POST', body: { email: fixture.patientBEmail, senha: password } });
  const professionalLogin = await request(origin, '/auth/login', { method: 'POST', body: { email: fixture.professionalEmail, senha: password } });
  assert.equal(patientALogin.status, 200);
  assert.equal(patientBLogin.status, 200);
  assert.equal(professionalLogin.status, 200);
  results.authentication = 'ok';

  const schedule = await request(origin, `/horarios?data=${fixture.date}`);
  assert.equal(schedule.status, 200);
  assert.deepEqual(schedule.data.horarios.map((slot) => slot.horario), ['09:00', '10:00', '11:00']);
  results.publicProfessionalResolution = 'ok';
  results.availability = 'ok';

  const booking = await request(origin, '/agendamentos', {
    method: 'POST', token: patientALogin.data.token,
    body: { data: fixture.date, horario: '09:00', modalidade: 'online' },
  });
  assert.equal(booking.status, 201);
  ids.appointments.push(booking.data.agendamento.id);

  const patientBIsolation = await request(origin, '/usuario/agendamentos', { token: patientBLogin.data.token });
  assert.equal(patientBIsolation.status, 200);
  assert.equal(patientBIsolation.data.length, 0);
  results.patientIsolation = 'ok';

  const confirmation = await request(origin, `/agendamentos/${booking.data.agendamento.id}/confirmar`, { method: 'PATCH', token: professionalLogin.data.token });
  assert.equal(confirmation.status, 200);
  const reschedule = await request(origin, `/agendamentos/${booking.data.agendamento.id}/reagendar`, {
    method: 'PATCH', token: professionalLogin.data.token,
    body: { data: fixture.date, horario: '11:00', modalidade: 'presencial' },
  });
  assert.equal(reschedule.status, 200);
  const cancellation = await request(origin, `/usuario/agendamentos/${booking.data.agendamento.id}/cancelar`, { method: 'PATCH', token: patientALogin.data.token });
  assert.equal(cancellation.status, 200);
  assert.equal(cancellation.data.agendamento.status, 'cancelado');
  results.appointmentLifecycle = 'ok';

  const concurrent = await Promise.all([
    request(origin, '/agendamentos', {
      method: 'POST', token: patientALogin.data.token,
      body: { data: fixture.date, horario: '10:00', modalidade: 'online', profissional_id: ids.professional },
    }),
    request(origin, '/agendamentos', {
      method: 'POST', token: patientBLogin.data.token,
      body: { data: fixture.date, horario: '10:00', modalidade: 'online', profissional_id: ids.professional },
    }),
  ]);
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [201, 409]);
  const winner = concurrent.find((response) => response.status === 201);
  ids.appointments.push(winner.data.agendamento.id);
  const [activeRows] = await db.query(
    `SELECT COUNT(*)::bigint AS total FROM agendamentos
     WHERE profissional_id = ? AND inicio = ? AND status IN ('agendado', 'confirmado')`,
    [ids.professional, `${fixture.date} 10:00:00`],
  );
  assert.equal(Number(activeRows[0].total), 1);
  results.concurrentBooking = 'ok';

  const block = await request(origin, '/agenda/bloqueios', {
    method: 'POST', token: professionalLogin.data.token,
    body: { profissional_id: ids.professional, tipo: 'data', data: fixture.date, hora_inicio: '11:00', hora_fim: '11:50', motivo: 'Bloqueio ficticio de integracao' },
  });
  assert.equal(block.status, 201);
  ids.blocks.push(block.data.bloqueio.id);
  const blockedSchedule = await request(origin, `/horarios?data=${fixture.date}&profissional_id=${ids.professional}`);
  assert.equal(blockedSchedule.status, 200);
  assert.equal(blockedSchedule.data.horarios.some((slot) => slot.horario === '11:00'), false);
  const removeBlock = await request(origin, `/agenda/bloqueios/${block.data.bloqueio.id}?profissional_id=${ids.professional}`, { method: 'DELETE', token: professionalLogin.data.token });
  assert.equal(removeBlock.status, 200);
  results.blocks = 'ok';

  const adminAgenda = await request(origin, `/agenda?data=${fixture.date}&profissional_id=${ids.professional}`, { token: professionalLogin.data.token });
  assert.equal(adminAgenda.status, 200);
  results.adminAgenda = 'ok';
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (previousDemoMode === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = previousDemoMode;
  if (previousDemoProfessionalEmail === undefined) delete process.env.DEMO_PROFESSIONAL_EMAIL;
  else process.env.DEMO_PROFESSIONAL_EMAIL = previousDemoProfessionalEmail;
  if (previousPublicProfessionalId === undefined) delete process.env.PUBLIC_PROFESSIONAL_ID;
  else process.env.PUBLIC_PROFESSIONAL_ID = previousPublicProfessionalId;
  await cleanup();
  const [remaining] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM profissionais WHERE email = ANY(?))
       + (SELECT COUNT(*) FROM pacientes WHERE email = ANY(?))
       + (SELECT COUNT(*) FROM usuarios_admin WHERE email = ANY(?)) AS total`,
    [ids.emails, ids.emails, ids.emails],
  );
  results.remainingFixtures = Number(remaining[0].total);
  await db.end();
}

assert.equal(results.remainingFixtures, 0);
console.log(JSON.stringify(results, null, 2));
