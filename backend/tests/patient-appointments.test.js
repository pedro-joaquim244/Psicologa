import 'dotenv/config';
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../src/database.js';
import patientRoutes from '../src/routes/usuario.routes.js';
import appointmentRoutes from '../src/routes/agendamentos.routes.js';
import slotRoutes from '../src/routes/horarios.routes.js';

// SQL real, exclusivamente em tabelas TEMPORARY desta conexão.
// As tabelas persistentes, contas e agendamentos existentes nunca recebem escritas.
const tables = ['pacientes', 'agendamentos', 'disponibilidades', 'bloqueios_agenda', 'profissionais', 'usuarios_admin'];
const originalQuery = db.query;
const originalGetConnection = db.getConnection;
let connection;
let server;
let origin;
const date = '2035-09-18';
const token = (id = 1, overrides = {}, options = {}) => jwt.sign({ id, email: `paciente${id}@example.com`, tipo: 'paciente', email_verificado: true, ...overrides }, process.env.JWT_SECRET, { expiresIn: '1h', ...options });
async function request(path, { credential = token(), method = 'GET', body } = {}) {
  const response = await fetch(`${origin}/api${path}`, { method, headers: { ...(credential ? { Authorization: `Bearer ${credential}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json(), cache: response.headers.get('cache-control') };
}

before(async () => {
  connection = await db.getConnection();
  for (const table of tables) {
    const [[schema]] = await connection.query(`SHOW CREATE TABLE ${table}`);
    // MySQL não permite FKs em tabelas temporárias; preservamos tipos, índices e slot_ativo.
    const temporary = schema['Create Table'].split('\n').filter((line) => !line.trim().startsWith('CONSTRAINT ')).join('\n').replace(/,\n\)/, '\n)').replace('CREATE TABLE', 'CREATE TEMPORARY TABLE');
    await connection.query(temporary);
  }
  db.query = (...args) => connection.query(...args);
  db.getConnection = async () => ({ query: (...args) => connection.query(...args), beginTransaction: () => connection.beginTransaction(), commit: () => connection.commit(), rollback: () => connection.rollback(), release() {} });
  const app = express();
  app.use(express.json());
  app.use('/api/usuario', patientRoutes);
  app.use('/api/agendamentos', appointmentRoutes);
  app.use('/api/horarios', slotRoutes);
  server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  origin = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  for (const table of tables) await connection.query(`DELETE FROM ${table}`);
  await connection.query("INSERT INTO profissionais (id, nome, ativo) VALUES (1, 'Profissional teste', 1)");
  await connection.query("INSERT INTO usuarios_admin (id, nome, email, senha, tipo, ativo, email_verificado_em) VALUES (1, 'Profissional teste', 'paciente1@example.com', 'hash', 'psicologa', 1, NOW())");
  await connection.query("INSERT INTO pacientes (id, nome, email, telefone, senha, ativo, email_verificado_em) VALUES (1, 'Paciente A', 'paciente1@example.com', '16999998888', 'hash', 1, NOW()), (2, 'Paciente B', 'paciente2@example.com', '16999997777', 'hash', 1, NOW())");
  await connection.query("INSERT INTO disponibilidades (profissional_id, dia_semana, hora_inicio, hora_fim, duracao_minutos, intervalo_minutos, ativo) VALUES (1, ?, '09:00', '12:00', 50, 10, 1)", [new Date(`${date}T12:00:00`).getDay()]);
  for (const [id, patient, hour, status] of [[101, 1, '09', 'confirmado'], [102, 2, '10', 'agendado'], [103, null, '11', 'concluido']]) {
    await connection.query('INSERT INTO agendamentos (id, paciente_id, profissional_id, nome_cliente, email_cliente, telefone_cliente, modalidade, inicio, fim, status) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)', [id, patient, 'Dado privado', 'privado@example.com', '16988888888', 'online', `${date} ${hour}:00:00`, `${date} ${hour}:50:00`, status]);
  }
});

after(async () => {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  db.query = originalQuery; db.getConnection = originalGetConnection;
  if (connection) {
    // Encerrar a conexão elimina suas tabelas temporárias automaticamente.
    connection.destroy();
  }
  await db.end();
});

test('JWT obrigatório, válido, verificado e exclusivo de paciente em ambas as rotas', async () => {
  for (const [credential, status] of [[null, 401], ['inválido', 401], [token(1, {}, { expiresIn: -1 }), 401], [token(1, { email_verificado: false }), 401], [token(1, { tipo: 'psicologa' }), 403], [token(1, { tipo: 'admin' }), 403]]) {
    assert.equal((await request('/usuario/agendamentos', { credential })).status, status);
    assert.equal((await request('/usuario/agendamentos/101/cancelar', { credential, method: 'PATCH' })).status, status);
  }
});

test('A e B recebem somente seus próprios registros e os seis campos públicos', async () => {
  for (const [id, expected] of [[1, 101], [2, 102]]) {
    const response = await request(`/usuario/agendamentos?paciente_id=${id === 1 ? 2 : 1}&usuario_id=999`, { credential: token(id) });
    assert.equal(response.status, 200);
    assert.equal(response.cache, 'no-store');
    assert.deepEqual(response.data.map((item) => item.id), [expected]);
    assert.deepEqual(Object.keys(response.data[0]).sort(), ['id', 'modalidade', 'inicio', 'fim', 'status', 'criado_em'].sort());
    assert.equal(response.data[0].inicio, `${date} ${id === 1 ? '09' : '10'}:00:00`);
  }
});

test('IDs adulterados, outro paciente e consulta antiga sem vínculo não podem ser cancelados', async () => {
  for (const id of [101, 103, 999999]) {
    const response = await request(`/usuario/agendamentos/${id}/cancelar`, { credential: token(2), method: 'PATCH', body: { paciente_id: 1, usuario_id: 1 } });
    assert.equal(response.status, 404);
    assert.deepEqual(response.data, { erro: 'Consulta não encontrada.' });
  }
  for (const id of ['0', '-1', '1.2', '1%20OR%201=1', '9007199254740992']) assert.equal((await request(`/usuario/agendamentos/${id}/cancelar`, { method: 'PATCH' })).status, 400);
  const [[row]] = await connection.query('SELECT status FROM agendamentos WHERE id = 101');
  assert.equal(row.status, 'confirmado');
});

test('cancelar é idempotente e libera o horário para uma nova reserva vinculada pelo JWT', async () => {
  const slotsBefore = await request(`/horarios?data=${date}`, { credential: null });
  assert.ok(!slotsBefore.data.horarios.some((slot) => slot.horario === '09:00'));
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await request('/usuario/agendamentos/101/cancelar', { method: 'PATCH' });
    assert.equal(response.status, 200);
    assert.equal(response.data.agendamento.status, 'cancelado');
  }
  const slotsAfter = await request(`/horarios?data=${date}`, { credential: null });
  assert.ok(slotsAfter.data.horarios.some((slot) => slot.horario === '09:00'));
  const created = await request('/agendamentos', { method: 'POST', credential: token(2), body: { data: date, horario: '09:00', modalidade: 'presencial', paciente_id: 1, usuario_id: 1, nome: 'Falsificado', email: 'falso@example.com' } });
  assert.equal(created.status, 201);
  const [[row]] = await connection.query('SELECT paciente_id, nome_cliente, email_cliente FROM agendamentos WHERE id = ?', [created.data.agendamento.id]);
  assert.deepEqual(row, { paciente_id: 2, nome_cliente: 'Paciente B', email_cliente: 'paciente2@example.com' });
  const listB = await request('/usuario/agendamentos', { credential: token(2) });
  assert.ok(listB.data.some((item) => item.id === created.data.agendamento.id && item.status === 'agendado'));
  const listA = await request('/usuario/agendamentos');
  assert.deepEqual(listA.data.map((item) => item.id), [101]);
});

test('preserva a regra atual de cancelamento sem antecedência mínima', async () => {
  await connection.query("UPDATE agendamentos SET status = 'concluido', inicio = '2020-01-01 09:00:00', fim = '2020-01-01 09:50:00' WHERE id = 101");
  const response = await request('/usuario/agendamentos/101/cancelar', { method: 'PATCH' });
  assert.equal(response.status, 200);
  assert.equal(response.data.agendamento.status, 'cancelado');
});

test('conta inativa, removida ou e-mail divergente perde acesso', async () => {
  assert.equal((await request('/usuario/agendamentos', { credential: token(999) })).status, 401);
  assert.equal((await request('/usuario/agendamentos', { credential: token(1, { email: 'outro@example.com' }) })).status, 401);
  await connection.query('UPDATE pacientes SET ativo = 0 WHERE id = 1');
  assert.equal((await request('/usuario/agendamentos')).status, 401);
});

test('paciente não acessa endpoints administrativos; profissional mantém acesso', async () => {
  assert.equal((await request('/agendamentos')).status, 403);
  assert.equal((await request('/agendamentos/102')).status, 403);
  assert.equal((await request('/agendamentos/102/cancelar', { method: 'PATCH' })).status, 403);
  const credential = token(1, { tipo: 'psicologa' });
  const admin = await request('/agendamentos', { credential });
  assert.equal(admin.status, 200);
  assert.equal(admin.data.length, 3);
  for (const action of ['confirmar', 'concluir', 'cancelar']) assert.equal((await request(`/agendamentos/102/${action}`, { credential, method: 'PATCH' })).status, 200);
});

test('profissional inativo, e-mail alterado e papel revogado não mantêm acesso', async () => {
  const credential = token(1, { tipo: 'psicologa' });
  for (const update of ["ativo = 0", "ativo = 1, email = 'outro@example.com'", "email = 'paciente1@example.com', tipo = 'admin'"]) {
    await connection.query('UPDATE usuarios_admin SET ' + update + ' WHERE id = 1');
    assert.equal((await request('/agendamentos', { credential })).status, 401);
  }
});

test('status administrativo distingue recurso ausente e transição incompatível', async () => {
  const credential = token(1, { tipo: 'psicologa' });
  assert.equal((await request('/agendamentos/101/confirmar', { credential, method: 'PATCH' })).status, 409);
  assert.equal((await request('/agendamentos/999999/confirmar', { credential, method: 'PATCH' })).status, 404);
  assert.equal((await request('/agendamentos/103/concluir', { credential, method: 'PATCH' })).status, 409);
});

test('rejeita datas impossíveis, passadas, IDs inválidos e horários fora do formato', async () => {
  for (const body of [{ data: '2035-02-30' }, { data: '2020-01-01' }, { horario: '09:00:00' }, { horario: ['09:00'] }, { profissional_id: {} }, { profissional_id: 0 }, { horario: '25:00' }]) {
    assert.equal((await request('/agendamentos', { method: 'POST', body: { data: date, horario: '11:00', modalidade: 'online', ...body } })).status, 400);
  }
  for (const query of ['data=2035-02-30', 'data=2035-09-18&profissional_id=abc', 'data=2035-09-18&data=2035-09-19']) assert.equal((await request('/horarios?' + query)).status, 400);
  const credential = token(1, { tipo: 'psicologa' });
  assert.equal((await request('/agendamentos/1.5', { credential })).status, 400);
});

test('bloqueio cruzando meia-noite e consulta iniciada no dia anterior retiram slots', async () => {
  await connection.query("INSERT INTO bloqueios_agenda (profissional_id, inicio, fim) VALUES (1, '2035-09-17 23:00:00', '2035-09-18 11:30:00')");
  assert.deepEqual((await request('/horarios?data=' + date)).data.horarios, []);
  assert.equal((await request('/agendamentos', { method: 'POST', body: { data: date, horario: '11:00', modalidade: 'online' } })).status, 409);
  await connection.query('DELETE FROM bloqueios_agenda');
  await connection.query("UPDATE agendamentos SET inicio = '2035-09-17 23:00:00', fim = '2035-09-18 11:30:00' WHERE id = 101");
  assert.deepEqual((await request('/horarios?data=' + date)).data.horarios, []);
});
