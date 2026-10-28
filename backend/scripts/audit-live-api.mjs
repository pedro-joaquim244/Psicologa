import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { readFileSync } from 'node:fs';

const API = process.env.AUDIT_API_URL || 'http://127.0.0.1:3333';
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 200) }; }
  const serialized = JSON.stringify(data);
  return {
    status: response.status,
    data,
    retryAfter: response.headers.get('retry-after'),
    senhaExposed: serialized.includes('"senha"') && !serialized.includes('senha incorret'),
  };
}

function sign(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
}

const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

try {
  const health = await request('/');
  record('GET / health', health.status === 200, `status=${health.status}`);

  const banco = await request('/api/teste-banco');
  record('GET /api/teste-banco (dev)', [200, 503].includes(banco.status), `status=${banco.status}`);

  const missing = await request('/api/nao-existe');
  record('404 JSON rota inexistente', missing.status === 404 && Boolean(missing.data?.erro), `status=${missing.status}`);

  const badDate = await request('/api/horarios?data=2026-13-40');
  record('GET /api/horarios data inválida = 400', badDate.status === 400, `status=${badDate.status}`);

  const slots = await request(`/api/horarios?data=${tomorrow}`);
  record('GET /api/horarios data futura', slots.status === 200 && Array.isArray(slots.data?.horarios), `status=${slots.status} n=${slots.data?.horarios?.length ?? 'n/a'}`);
  if (slots.status === 200 && slots.data.horarios.length) {
    const order = slots.data.horarios.map((item) => item.horario);
    const sorted = [...order].sort();
    record('horários públicos em ordem crescente', order.join() === sorted.join(), order.join(', '));
  } else {
    record('horários públicos em ordem crescente', true, 'sem horários para comparar');
  }

  const unauthAgenda = await request(`/api/agenda?data=${tomorrow}`);
  record('GET /api/agenda sem token = 401', unauthAgenda.status === 401, `status=${unauthAgenda.status}`);

  const unauthAppointments = await request('/api/agendamentos');
  record('GET /api/agendamentos sem token = 401', unauthAppointments.status === 401, `status=${unauthAppointments.status}`);

  const unauthPatient = await request('/api/usuario/agendamentos');
  record('GET /api/usuario/agendamentos sem token = 401', unauthPatient.status === 401, `status=${unauthPatient.status}`);

  const unauthBook = await request('/api/agendamentos', { method: 'POST', body: JSON.stringify({ data: tomorrow, horario: '10:00', modalidade: 'online' }) });
  record('POST /api/agendamentos sem token = 401', unauthBook.status === 401, `status=${unauthBook.status}`);

  const badLogin = await request('/api/pacientes/login', { method: 'POST', body: JSON.stringify({ email: 'naoexiste@example.com', senha: 'SenhaErrada123!' }) });
  record('login paciente inexistente = 401', badLogin.status === 401, `status=${badLogin.status} senhaExposed=${badLogin.senhaExposed}`);

  const badAdmin = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'naoexiste@example.com', senha: 'SenhaErrada123!' }) });
  record('login psicóloga inexistente = 401', badAdmin.status === 401, `status=${badAdmin.status} senhaExposed=${badAdmin.senhaExposed}`);

  const invalidJson = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
  record('JSON inválido = 400', invalidJson.status === 400, `status=${invalidJson.status}`);

  const fakePatient = sign({ id: 999999, tipo: 'paciente', email: 'fake@example.com', email_verificado: true });
  const fakePatientMe = await request('/api/pacientes/me', { headers: { Authorization: `Bearer ${fakePatient}` } });
  record('JWT paciente inventado = 401', fakePatientMe.status === 401, `status=${fakePatientMe.status}`);

  const fakePsych = sign({ id: 999999, tipo: 'psicologa', email: 'fake@example.com', email_verificado: true, profissional_id: 1 });
  const fakeAgenda = await request(`/api/agenda?data=${tomorrow}`, { headers: { Authorization: `Bearer ${fakePsych}` } });
  record('JWT psicóloga inventada = 401', fakeAgenda.status === 401, `status=${fakeAgenda.status}`);

  const unverified = sign({ id: 1, tipo: 'paciente', email: 'x@example.com', email_verificado: false });
  const unverifiedMe = await request('/api/pacientes/me', { headers: { Authorization: `Bearer ${unverified}` } });
  record('JWT sem email_verificado = 401', unverifiedMe.status === 401, `status=${unverifiedMe.status}`);

  const patientAsAdmin = sign({ id: 1, tipo: 'paciente', email: 'x@example.com', email_verificado: true });
  const patientAdmin = await request(`/api/agenda?data=${tomorrow}`, { headers: { Authorization: `Bearer ${patientAsAdmin}` } });
  record('paciente em rota admin = 401/403', [401, 403].includes(patientAdmin.status), `status=${patientAdmin.status}`);

  const cors = await fetch(`${API}/api/horarios?data=${tomorrow}`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://evil.example', 'Access-Control-Request-Method': 'GET' },
  });
  record('CORS preflight origem estranha não 500', cors.status !== 500, `status=${cors.status} allow=${cors.headers.get('access-control-allow-origin')}`);

  const statuses = [];
  for (let i = 0; i < 12; i += 1) {
    const response = await request('/api/pacientes/login', { method: 'POST', body: JSON.stringify({ email: `limite${i}@example.com`, senha: 'SenhaErrada123!' }) });
    statuses.push(response.status);
    if (response.status === 429) {
      record('rate limit login = 429', true, `tentativa=${i + 1} retry-after=${response.retryAfter} codigo=${response.data?.codigo}`);
      break;
    }
  }
  if (!statuses.includes(429)) record('rate limit login = 429', false, `status=[${statuses.join(',')}]`);

  const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  for (const name of ['JWT_SECRET', 'DB_PASSWORD', 'SMTP_PASS', 'DB_HOST', 'FRONTEND_URL']) {
    record(`env example documenta ${name}`, envExample.includes(name), '');
  }
  record('JWT_SECRET configurado', Boolean(process.env.JWT_SECRET && Buffer.byteLength(process.env.JWT_SECRET, 'utf8') >= 32 && process.env.JWT_SECRET !== 'configure-um-segredo-longo-e-aleatorio'), process.env.JWT_SECRET ? 'presente' : 'ausente');
  record('SMTP_HOST configurado', Boolean(process.env.SMTP_HOST), process.env.SMTP_HOST ? 'presente' : 'ausente');
  record('SMTP_PASS configurado', Boolean(process.env.SMTP_PASS), process.env.SMTP_PASS ? 'presente' : 'ausente');
} catch (error) {
  record('script de auditoria API', false, error.message);
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} checagens OK`);
if (failed.length) process.exitCode = 1;
