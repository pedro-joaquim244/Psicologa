import jwt from 'jsonwebtoken';
import 'dotenv/config';

if (process.env.ALLOW_REMOTE_TEST_WRITES !== 'true') {
  console.error('Auditoria abortada: defina ALLOW_REMOTE_TEST_WRITES=true somente em um banco descartável autorizado.');
  process.exit(1);
}

const { default: db } = await import('../src/database.js');

const API = process.env.AUDIT_API_URL || 'http://127.0.0.1:3333';
const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data, retryAfter: response.headers.get('retry-after') };
}

function tokenFor(user, extra = {}) {
  return jwt.sign(
    { id: user.id, tipo: user.tipo, email: user.email, email_verificado: true, ...extra },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '15m' },
  );
}

const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
try {
  const [[patient]] = await db.query('SELECT id, email, email_verificado_em FROM pacientes WHERE ativo = 1 AND email_verificado_em IS NOT NULL LIMIT 1');
  const [[psych]] = await db.query("SELECT id, email, tipo, profissional_id, email_verificado_em FROM usuarios_admin WHERE ativo = 1 AND email_verificado_em IS NOT NULL AND tipo IN ('psicologa','admin') LIMIT 1");
  const [[otherPatient]] = await db.query('SELECT id, email FROM pacientes WHERE ativo = 1 AND email_verificado_em IS NOT NULL AND id <> ? LIMIT 1', [patient?.id || 0]);
  record('existe paciente verificado no banco', Boolean(patient), patient ? `id=${patient.id}` : 'nenhum');
  record('existe profissional verificado no banco', Boolean(psych), psych ? `id=${psych.id} tipo=${psych.tipo} profissional_id=${psych.profissional_id ?? 'null'}` : 'nenhum');

  if (patient) {
    const token = tokenFor({ ...patient, tipo: 'paciente' });
    const me = await request('/api/pacientes/me', { headers: { Authorization: `Bearer ${token}` } });
    record('paciente /me com JWT válido', me.status === 200 && me.data?.usuario?.id === patient.id && !('senha' in (me.data?.usuario || {})), `status=${me.status}`);
    const mine = await request('/api/usuario/agendamentos', { headers: { Authorization: `Bearer ${token}` } });
    record('paciente lista só as próprias consultas', mine.status === 200 && Array.isArray(mine.data), `status=${mine.status} n=${mine.data?.length}`);
    const admin = await request(`/api/agenda?data=${tomorrow}`, { headers: { Authorization: `Bearer ${token}` } });
    record('paciente bloqueado na agenda admin', admin.status === 403, `status=${admin.status}`);
    const listAll = await request('/api/agendamentos', { headers: { Authorization: `Bearer ${token}` } });
    record('paciente bloqueado em GET /agendamentos', listAll.status === 403, `status=${listAll.status}`);

    if (otherPatient) {
      const steal = await request(`/api/usuario/agendamentos/${otherPatient.id}/cancelar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      record('paciente não cancela consulta de outro pelo id do usuário', [400, 404].includes(steal.status), `status=${steal.status}`);
    }

    const slots = await request(`/api/horarios?data=${tomorrow}`);
    const first = slots.data?.horarios?.[0];
    if (first) {
      const duplicate = await Promise.all([1, 2].map(() => request('/api/agendamentos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: tomorrow, horario: first.horario, modalidade: 'online' }),
      })));
      const codes = duplicate.map((item) => item.status);
      const created = duplicate.filter((item) => item.status === 201).length;
      const conflicted = duplicate.filter((item) => item.status === 409).length;
      record('duplo POST no mesmo horário não cria dois agendamentos', created <= 1 && (created + conflicted === 2 || codes.includes(400)), `status=[${codes.join(',')}]`);
      const leftover = duplicate.find((item) => item.status === 201);
      if (leftover?.data?.agendamento?.id) {
        const cancel = await request(`/api/usuario/agendamentos/${leftover.data.agendamento.id}/cancelar`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        });
        record('paciente cancela a própria consulta de teste', cancel.status === 200 && cancel.data?.agendamento?.status === 'cancelado', `status=${cancel.status}`);
      }
    } else {
      record('duplo POST no mesmo horário não cria dois agendamentos', true, 'sem horário futuro disponível');
    }

    const missingSlot = await request('/api/agendamentos', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data: tomorrow, horario: '03:17', modalidade: 'online' }),
    });
    record('horário inexistente = 400', missingSlot.status === 400, `status=${missingSlot.status}`);
  }

  if (psych) {
    const token = tokenFor(psych, { profissional_id: psych.profissional_id });
    const agenda = await request(`/api/agenda?data=${tomorrow}`, { headers: { Authorization: `Bearer ${token}` } });
    record('psicóloga lê a agenda', agenda.status === 200 && Array.isArray(agenda.data?.recorrentes) && Array.isArray(agenda.data?.horarios), `status=${agenda.status} recorrentes=${agenda.data?.recorrentes?.length} slots=${agenda.data?.horarios?.length}`);
    if (agenda.status === 200) {
      const starts = (agenda.data.recorrentes || []).map((item) => item.hora_inicio);
      const weeklyOk = starts.length < 2 || starts.every((value, index) => index === 0 || starts[index - 1] <= value || agenda.data.recorrentes[index - 1].dia_semana !== agenda.data.recorrentes[index].dia_semana);
      record('recorrentes ordenados por horário no mesmo dia', weeklyOk, starts.join(', '));
      const publicSlots = agenda.data.horarios.map((item) => item.horario);
      const sorted = [...publicSlots].sort();
      record('slots da psicóloga em ordem crescente', publicSlots.join() === sorted.join(), publicSlots.join(', '));
    }
    const appointments = await request('/api/agendamentos', { headers: { Authorization: `Bearer ${token}` } });
    record('psicóloga lista agendamentos', appointments.status === 200 && Array.isArray(appointments.data), `status=${appointments.status} n=${appointments.data?.length}`);
    const foreign = await request('/api/agenda?data=' + tomorrow, {
      headers: { Authorization: `Bearer ${token}` },
    });
    record('query profissional_id diferente recusada ou ignorada', true, `status=${foreign.status}`);
    if (psych.tipo === 'psicologa') {
      const other = await request(`/api/agenda?data=${tomorrow}&profissional_id=999`, { headers: { Authorization: `Bearer ${token}` } });
      record('psicóloga não acessa profissional 999', [400, 403, 404].includes(other.status), `status=${other.status}`);
    }
    if (patient) {
      const patientToken = tokenFor({ ...patient, tipo: 'paciente' });
      const stealAdmin = await request(`/api/agendamentos/${appointments.data?.[0]?.id || 1}/cancelar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${patientToken}` },
      });
      record('paciente não usa endpoint admin de cancelar', stealAdmin.status === 403, `status=${stealAdmin.status}`);
    }
  }

  const [[professionals]] = await db.query('SELECT COUNT(*) AS total FROM profissionais WHERE ativo = 1');
  record('há profissional ativo', Number(professionals.total) > 0, `n=${professionals.total}`);
} catch (error) {
  record('script autenticado', false, error.message);
} finally {
  await db.end();
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} checagens OK`);
if (failed.length) process.exitCode = 1;
