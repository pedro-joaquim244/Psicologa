import 'dotenv/config';
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../src/database.js';
import agendaRoutes from '../src/routes/agenda.routes.js';
import appointmentRoutes from '../src/routes/agendamentos.routes.js';
import slotRoutes from '../src/routes/horarios.routes.js';
import { ensureAgendaSchema } from '../src/services/agendaSchema.js';

// Todas as escritas abaixo ocorrem em tabelas TEMPORARY desta conexão.
// Não copiamos dados, não alteramos o schema persistente e não enviamos e-mails.
const tables = ['profissionais', 'usuarios_admin', 'pacientes', 'disponibilidades', 'bloqueios_agenda', 'agendamentos'];
const original = { query: db.query, getConnection: db.getConnection };
const date = '2035-09-18'; // Terça-feira, mantendo os testes independentes do dia atual.
const weekday = 2;
const initialSlots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
let connection, server, origin;

const credential = (tipo = 'psicologa', overrides = {}, options = {}) => jwt.sign({
  id: tipo === 'admin' ? 2 : 1,
  email: tipo === 'paciente' ? 'paciente@example.com' : tipo === 'admin' ? 'admin@example.com' : 'psicologa@example.com',
  tipo,
  email_verificado: true,
  ...overrides,
}, process.env.JWT_SECRET, { expiresIn: '1h', ...options });

async function request(path, { method = 'GET', body, token = credential() } = {}) {
  const response = await fetch(`${origin}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  return { status: response.status, data, cache: response.headers.get('cache-control') };
}

const extra = (overrides = {}) => ({ tipo: 'extra', profissional_id: 1, data: date, hora_inicio: '18:00', hora_fim: '18:50', ...overrides });
const recurring = (overrides = {}) => ({ tipo: 'recorrente', profissional_id: 1, dia_semana: weekday, hora_inicio: '06:00', hora_fim: '08:00', duracao_minutos: 30, intervalo_minutos: 15, ...overrides });
const block = (overrides = {}) => ({ profissional_id: 1, data: date, hora_inicio: '15:00', hora_fim: '15:50', motivo: 'Compromisso pessoal privado', ...overrides });

async function publicSlots(day = date, professional = 1) {
  const result = await request(`/horarios?data=${day}&profissional_id=${professional}`, { token: null });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return result.data.horarios;
}

async function createAvailability(body = extra()) {
  const result = await request('/agenda/disponibilidades', { method: 'POST', body });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.ok(result.data.disponibilidade.id);
  return result.data.disponibilidade;
}

async function createBlock(body = block()) {
  const result = await request('/agenda/bloqueios', { method: 'POST', body });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.ok(result.data.bloqueio.id);
  return result.data.bloqueio;
}

async function insertAppointment({ id = 101, status = 'agendado', inicio = `${date} 18:00:00`, fim = `${date} 18:50:00` } = {}) {
  await connection.query(`INSERT INTO agendamentos
    (id, paciente_id, profissional_id, nome_cliente, email_cliente, telefone_cliente, modalidade, inicio, fim, status)
    VALUES (?, 1, 1, 'Paciente teste', 'paciente@example.com', '16999998888', 'online', ?, ?, ?)`, [id, inicio, fim, status]);
}

before(async () => {
  connection = await db.getConnection();
  for (const table of tables) {
    const [[schema]] = await connection.query(`SHOW CREATE TABLE ${table}`);
    const ddl = schema['Create Table'].split('\n').filter((line) => !line.trim().startsWith('CONSTRAINT ')).join('\n').replace(/,\n\)/, '\n)').replace('CREATE TABLE', 'CREATE TEMPORARY TABLE');
    await connection.query(ddl);
  }
  // A migração afeta somente a disponibilidades temporária já criada acima.
  await ensureAgendaSchema(connection);
  db.query = (...args) => connection.query(...args);
  db.getConnection = async () => ({
    query: (...args) => connection.query(...args),
    beginTransaction: () => connection.beginTransaction(),
    commit: () => connection.commit(),
    rollback: () => connection.rollback(),
    release() {},
  });
  const app = express();
  app.use(express.json());
  app.use('/api/agenda', agendaRoutes);
  app.use('/api/agendamentos', appointmentRoutes);
  app.use('/api/horarios', slotRoutes);
  server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  origin = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  for (const table of tables) await connection.query(`DELETE FROM ${table}`);
  await connection.query("INSERT INTO profissionais (id, nome, ativo) VALUES (1, 'Profissional teste', 1), (2, 'Outra profissional', 1)");
  await connection.query("INSERT INTO usuarios_admin (id, nome, email, senha, tipo, ativo, email_verificado_em) VALUES (1, 'Psicóloga teste', 'psicologa@example.com', 'hash', 'psicologa', 1, NOW()), (2, 'Admin teste', 'admin@example.com', 'hash', 'admin', 1, NOW())");
  await connection.query("INSERT INTO pacientes (id, nome, email, telefone, senha, ativo, email_verificado_em) VALUES (1, 'Paciente teste', 'paciente@example.com', '16999998888', 'hash', 1, NOW())");
  await connection.query("INSERT INTO disponibilidades (id, profissional_id, dia_semana, hora_inicio, hora_fim, duracao_minutos, intervalo_minutos, ativo) VALUES (1, 1, ?, '09:00', '12:00', 50, 10, 1), (2, 1, ?, '14:00', '18:00', 50, 10, 1)", [weekday, weekday]);
});

after(async () => {
  server?.closeAllConnections();
  if (server) await new Promise((resolve) => server.close(resolve));
  db.query = original.query;
  db.getConnection = original.getConnection;
  connection?.destroy(); // MySQL remove apenas as tabelas temporárias desta conexão.
  await db.end();
});

test('todas as rotas de gestão exigem sessão administrativa válida, inclusive leitura e exclusão', async () => {
  const operations = [
    [`/agenda?data=${date}`, 'GET'],
    ['/agenda/disponibilidades', 'POST', extra()],
    ['/agenda/disponibilidades/1', 'PATCH', recurring()],
    ['/agenda/disponibilidades/1', 'DELETE'],
    ['/agenda/bloqueios', 'POST', block()],
    ['/agenda/bloqueios/1', 'PATCH', block()],
    ['/agenda/bloqueios/1', 'DELETE'],
  ];
  for (const [token, status] of [[null, 401], ['invalido', 401], [credential('psicologa', {}, { expiresIn: -1 }), 401], [credential('psicologa', { email_verificado: false }), 401], [credential('paciente'), 403]]) {
    for (const [path, method, body] of operations) {
      const result = await request(path, { method, body, token });
      assert.equal(result.status, status, `${method} ${path}: ${JSON.stringify(result.data)}`);
    }
  }
  for (const role of ['psicologa', 'admin']) assert.equal((await request(`/agenda?data=${date}`, { token: credential(role) })).status, 200);
  const [[unchanged]] = await connection.query('SELECT COUNT(*) AS total FROM disponibilidades');
  assert.equal(unchanged.total, 2);
});

test('conta administrativa inativa ou alterada não mantém permissão por um JWT antigo', async () => {
  const token = credential();
  for (const assignment of ["ativo = 0", "ativo = 1, email = 'alterado@example.com'", "email = 'psicologa@example.com', tipo = 'admin'"]) {
    await connection.query('UPDATE usuarios_admin SET ' + assignment + ' WHERE id = 1');
    assert.equal((await request('/agenda/disponibilidades', { method: 'POST', body: extra(), token })).status, 401);
    assert.equal((await request(`/agenda?data=${date}`, { token })).status, 401);
  }
});

test('horário extra é criado, editado e excluído somente na data escolhida', async () => {
  const created = await createAvailability();
  assert.deepEqual((await publicSlots()).map((slot) => slot.horario), [...initialSlots, '18:00']);
  assert.deepEqual((await publicSlots('2035-09-25')).map((slot) => slot.horario), initialSlots);
  const snapshot = await request(`/agenda?data=${date}`);
  assert.equal(snapshot.cache, 'no-store');
  assert.equal(snapshot.data.extras.length, 1);
  assert.equal(snapshot.data.recorrentes.length, 2);
  assert.equal(snapshot.data.extras[0].id, created.id);
  assert.equal(snapshot.data.extras[0].data, date);
  const edited = await request(`/agenda/disponibilidades/${created.id}`, { method: 'PATCH', body: extra({ hora_inicio: '19:00', hora_fim: '20:00' }) });
  assert.equal(edited.status, 200, JSON.stringify(edited.data));
  assert.deepEqual((await publicSlots()).at(-1), { horario: '19:00', fim: '20:00' });
  assert.ok(!(await publicSlots()).some((slot) => slot.horario === '18:00'));
  assert.equal((await request(`/agenda/disponibilidades/${created.id}`, { method: 'DELETE' })).status, 200);
  assert.deepEqual((await publicSlots()).map((slot) => slot.horario), initialSlots);
  assert.equal((await request('/agendamentos', { method: 'POST', token: credential('paciente'), body: { data: date, horario: '19:00', modalidade: 'online' } })).status, 400);
  assert.equal((await request(`/agenda/disponibilidades/${created.id}`, { method: 'DELETE' })).status, 404);
});

test('extra funciona em domingo sem recorrência e sua duração é a duração reservada pelo paciente', async () => {
  const sunday = '2035-09-16';
  assert.deepEqual(await publicSlots(sunday), []);
  await createAvailability(extra({ data: sunday, hora_inicio: '18:00', hora_fim: '19:15' }));
  assert.deepEqual(await publicSlots(sunday), [{ horario: '18:00', fim: '19:15' }]);
  assert.deepEqual(await publicSlots('2035-09-23'), []);
  const body = { data: sunday, horario: '18:00', modalidade: 'online', paciente_id: 999, nome: 'Falso' };
  assert.equal((await request('/agendamentos', { method: 'POST', token: null, body })).status, 401);
  const booking = await request('/agendamentos', { method: 'POST', token: credential('paciente'), body });
  assert.equal(booking.status, 201, JSON.stringify(booking.data));
  assert.equal(booking.data.agendamento.horarioFim, '19:15');
  const [[stored]] = await connection.query('SELECT paciente_id, nome_cliente, inicio, fim FROM agendamentos WHERE id = ?', [booking.data.agendamento.id]);
  assert.deepEqual(stored, { paciente_id: 1, nome_cliente: 'Paciente teste', inicio: `${sunday} 18:00:00`, fim: `${sunday} 19:15:00` });
  assert.deepEqual(await publicSlots(sunday), []);
});

test('recorrências respeitam duração e intervalo, admitem edição e valem nas próximas semanas', async () => {
  const created = await createAvailability(recurring());
  const expected = [{ horario: '06:00', fim: '06:30' }, { horario: '06:45', fim: '07:15' }, { horario: '07:30', fim: '08:00' }];
  for (const day of [date, '2035-09-25', '2035-10-02']) assert.deepEqual((await publicSlots(day)).slice(0, 3), expected);
  assert.deepEqual(await publicSlots('2035-09-19'), []);
  const updated = await request(`/agenda/disponibilidades/${created.id}`, { method: 'PATCH', body: recurring({ hora_fim: '07:00', duracao_minutos: 20, intervalo_minutos: 10 }) });
  assert.equal(updated.status, 200, JSON.stringify(updated.data));
  assert.deepEqual((await publicSlots()).slice(0, 2), [{ horario: '06:00', fim: '06:20' }, { horario: '06:30', fim: '06:50' }]);
  assert.equal((await request(`/agenda/disponibilidades/${created.id}`, { method: 'DELETE' })).status, 200);
  assert.deepEqual((await publicSlots('2035-09-25')).map((slot) => slot.horario), initialSlots);
});

test('bloqueio cobre todos os slots conflitantes, pode mudar de período e sua exclusão libera a rotina', async () => {
  const created = await createBlock(block({ hora_inicio: '09:30', hora_fim: '11:30' }));
  assert.deepEqual((await publicSlots()).map((slot) => slot.horario), ['14:00', '15:00', '16:00', '17:00']);
  const updated = await request(`/agenda/bloqueios/${created.id}`, { method: 'PATCH', body: block({ hora_inicio: '14:10', hora_fim: '15:10', motivo: 'Motivo atualizado' }) });
  assert.equal(updated.status, 200, JSON.stringify(updated.data));
  assert.deepEqual((await publicSlots()).map((slot) => slot.horario), ['09:00', '10:00', '11:00', '16:00', '17:00']);
  const snapshot = await request(`/agenda?data=${date}`);
  assert.equal(snapshot.data.bloqueios[0].motivo, 'Motivo atualizado');
  assert.equal((await request(`/agenda/bloqueios/${created.id}`, { method: 'DELETE' })).status, 200);
  assert.deepEqual((await publicSlots()).map((slot) => slot.horario), initialSlots);
  assert.equal((await request(`/agenda/bloqueios/${created.id}`, { method: 'DELETE' })).status, 404);
});

test('fronteiras encostadas não se sobrepõem e o motivo de bloqueio nunca aparece na API pública', async () => {
  await createBlock(block({ hora_inicio: '09:50', hora_fim: '10:00' }));
  assert.deepEqual((await publicSlots()).map((slot) => slot.horario), initialSlots);
  const result = await request(`/horarios?data=${date}&incluir=motivo,bloqueios`, { token: credential('paciente') });
  assert.deepEqual(Object.keys(result.data).sort(), ['data', 'horarios']);
  assert.ok(!JSON.stringify(result.data).includes('Compromisso pessoal'));
  for (const slot of result.data.horarios) assert.deepEqual(Object.keys(slot).sort(), ['fim', 'horario']);
  const snapshot = await request(`/agenda?data=${date}`);
  assert.equal(snapshot.data.bloqueios[0].motivo, 'Compromisso pessoal privado');
  const booking = await request('/agendamentos', { method: 'POST', token: credential('paciente'), body: { data: date, horario: '09:00', modalidade: 'online' } });
  assert.equal(booking.status, 201);
  assert.ok(!JSON.stringify(booking.data).includes('Compromisso pessoal'));
});

test('consultas agendadas e confirmadas impedem extras e bloqueios com 409 sem cancelar a consulta', async () => {
  for (const status of ['agendado', 'confirmado']) {
    await connection.query('DELETE FROM agendamentos');
    await insertAppointment({ status });
    for (const [path, body] of [
      ['/agenda/disponibilidades', extra()],
      ['/agenda/bloqueios', block({ hora_inicio: '18:20', hora_fim: '19:00' })],
    ]) {
      const result = await request(path, { method: 'POST', body });
      assert.equal(result.status, 409, JSON.stringify(result.data));
      assert.match(result.data.erro, /consulta/i);
    }
    const [[stored]] = await connection.query('SELECT status, inicio, fim FROM agendamentos WHERE id = 101');
    assert.deepEqual(stored, { status, inicio: `${date} 18:00:00`, fim: `${date} 18:50:00` });
  }
});

test('consultas canceladas e concluídas não ocupam horários para novas alterações', async () => {
  await insertAppointment({ id: 101, status: 'cancelado' });
  await insertAppointment({ id: 102, status: 'concluido', inicio: `${date} 19:00:00`, fim: `${date} 19:50:00` });
  await createAvailability();
  await createBlock(block({ hora_inicio: '19:00', hora_fim: '19:50' }));
  assert.ok((await publicSlots()).some((slot) => slot.horario === '18:00'));
  const [rows] = await connection.query('SELECT status FROM agendamentos ORDER BY id');
  assert.deepEqual(rows.map((row) => row.status), ['cancelado', 'concluido']);
});

test('extras rejeitam conflitos com recorrências, outros extras e bloqueios', async () => {
  await createAvailability();
  await createBlock(block({ hora_inicio: '20:00', hora_fim: '20:50' }));
  for (const body of [extra(), extra({ hora_inicio: '18:20', hora_fim: '19:10' }), extra({ hora_inicio: '09:20', hora_fim: '10:10' }), extra({ hora_inicio: '20:10', hora_fim: '21:00' })]) {
    assert.equal((await request('/agenda/disponibilidades', { method: 'POST', body })).status, 409);
  }
  assert.equal((await request('/agenda/disponibilidades', { method: 'POST', body: recurring({ hora_inicio: '10:00', hora_fim: '13:00' }) })).status, 409);
  assert.equal((await request('/agenda/disponibilidades', { method: 'POST', body: recurring({ hora_inicio: '18:00', hora_fim: '19:00', duracao_minutos: 30 }) })).status, 409);
  await createAvailability(extra({ hora_inicio: '18:50', hora_fim: '19:40' }));
  assert.deepEqual((await publicSlots()).slice(-2), [{ horario: '18:00', fim: '18:50' }, { horario: '18:50', fim: '19:40' }]);
});

test('bloqueios sobrepostos retornam 409 e uma edição inválida preserva o bloqueio anterior', async () => {
  const first = await createBlock(block({ hora_inicio: '09:00', hora_fim: '10:00' }));
  const second = await createBlock(block({ hora_inicio: '11:00', hora_fim: '12:00' }));
  assert.equal((await request('/agenda/bloqueios', { method: 'POST', body: block({ hora_inicio: '09:30', hora_fim: '10:30' }) })).status, 409);
  assert.equal((await request(`/agenda/bloqueios/${second.id}`, { method: 'PATCH', body: block({ hora_inicio: '09:30', hora_fim: '10:30' }) })).status, 409);
  const snapshot = await request(`/agenda?data=${date}`);
  assert.deepEqual(snapshot.data.bloqueios.map((item) => [item.id, item.hora_inicio.slice(0, 5)]), [[first.id, '09:00'], [second.id, '11:00']]);
  await createBlock(block({ hora_inicio: '10:00', hora_fim: '11:00' }));
});

test('extra reservado não pode ser removido ou movido e a consulta mantém início, fim e status', async () => {
  const created = await createAvailability();
  await insertAppointment({ status: 'confirmado' });
  assert.equal((await request(`/agenda/disponibilidades/${created.id}`, { method: 'DELETE' })).status, 409);
  assert.equal((await request(`/agenda/disponibilidades/${created.id}`, { method: 'PATCH', body: extra({ hora_inicio: '19:00', hora_fim: '19:50' }) })).status, 409);
  const [[stored]] = await connection.query('SELECT status, inicio, fim FROM agendamentos WHERE id = 101');
  assert.deepEqual(stored, { status: 'confirmado', inicio: `${date} 18:00:00`, fim: `${date} 18:50:00` });
  const snapshot = await request(`/agenda?data=${date}`);
  assert.equal(snapshot.data.extras[0].hora_inicio.slice(0, 5), '18:00');
});

test('editar ou remover recorrência não deixa consultas futuras sem o mesmo intervalo de atendimento', async () => {
  await insertAppointment({ inicio: `${date} 09:00:00`, fim: `${date} 09:50:00` });
  assert.equal((await request('/agenda/disponibilidades/1', { method: 'DELETE' })).status, 409);
  const body = recurring({ hora_inicio: '09:00', hora_fim: '12:00', duracao_minutos: 30, intervalo_minutos: 0 });
  assert.equal((await request('/agenda/disponibilidades/1', { method: 'PATCH', body })).status, 409);
  const expanded = await request('/agenda/disponibilidades/1', { method: 'PATCH', body: { ...body, hora_fim: '13:00', duracao_minutos: 50, intervalo_minutos: 10 } });
  assert.equal(expanded.status, 200, JSON.stringify(expanded.data));
  assert.ok((await publicSlots()).some((slot) => slot.horario === '12:00'));
  const [[stored]] = await connection.query('SELECT status FROM agendamentos WHERE id = 101');
  assert.equal(stored.status, 'agendado');
});

test('recorrência compatível com extra não duplica slots e pode ser removida quando o extra mantém a consulta', async () => {
  await createAvailability();
  const created = await createAvailability(recurring({ hora_inicio: '18:00', hora_fim: '19:00', duracao_minutos: 50, intervalo_minutos: 10 }));
  assert.equal((await publicSlots()).filter((slot) => slot.horario === '18:00').length, 1);
  await insertAppointment();
  assert.equal((await request(`/agenda/disponibilidades/${created.id}`, { method: 'DELETE' })).status, 200);
  const [[stored]] = await connection.query('SELECT status FROM agendamentos WHERE id = 101');
  assert.equal(stored.status, 'agendado');
  assert.ok(!(await publicSlots()).some((slot) => slot.horario === '18:00'));
  assert.deepEqual((await publicSlots('2035-09-25')).map((slot) => slot.horario), initialSlots);
});

test('excluir bloqueio só libera os intervalos que continuam sem consulta ativa', async () => {
  const created = await createBlock(block({ hora_inicio: '09:00', hora_fim: '11:50', motivo: '' }));
  // Simula um bloqueio legado que já coexistia com uma consulta antes da gestão.
  await insertAppointment({ inicio: `${date} 10:00:00`, fim: `${date} 10:50:00`, status: 'confirmado' });
  assert.equal((await request(`/agenda/bloqueios/${created.id}`, { method: 'DELETE' })).status, 200);
  assert.deepEqual((await publicSlots()).map((slot) => slot.horario), ['09:00', '11:00', '14:00', '15:00', '16:00', '17:00']);
  const [[stored]] = await connection.query('SELECT COUNT(*) AS total, MAX(status) AS status FROM agendamentos');
  assert.deepEqual(stored, { total: 1, status: 'confirmado' });
});

test('lista pública e POST usam os mesmos slots, durações e bloqueios', async () => {
  await createAvailability(recurring());
  await createAvailability();
  await createBlock();
  const listed = await publicSlots();
  assert.ok(!listed.some((slot) => slot.horario === '15:00'));
  for (const slot of listed) {
    const result = await request('/agendamentos', { method: 'POST', token: credential('paciente'), body: { data: date, horario: slot.horario, modalidade: 'presencial' } });
    assert.equal(result.status, 201, `${slot.horario}: ${JSON.stringify(result.data)}`);
    assert.equal(result.data.agendamento.horarioFim, slot.fim);
  }
  assert.deepEqual(await publicSlots(), []);
  assert.equal((await request('/agendamentos', { method: 'POST', token: credential('paciente'), body: { data: date, horario: '15:00', modalidade: 'online' } })).status, 409);
  assert.equal((await request('/agendamentos', { method: 'POST', token: credential('paciente'), body: { data: date, horario: '12:15', modalidade: 'online' } })).status, 400);
});

test('profissionais têm disponibilidades independentes e não recebem extras ou bloqueios de outro profissional', async () => {
  await createAvailability();
  await createBlock();
  assert.deepEqual(await publicSlots(date, 2), []);
  await createAvailability(extra({ profissional_id: 2 }));
  assert.deepEqual(await publicSlots(date, 2), [{ horario: '18:00', fim: '18:50' }]);
  const snapshot = await request(`/agenda?data=${date}&profissional_id=2`);
  assert.equal(snapshot.data.recorrentes.length, 0);
  assert.equal(snapshot.data.extras.length, 1);
  assert.equal(snapshot.data.bloqueios.length, 0);
});

test('calendário, relógio, duração, intervalo e identificadores inválidos são rejeitados sem alterar a agenda', async () => {
  for (const body of [extra({ data: '2035-02-30' }), extra({ data: '2020-01-01' }), extra({ data: ['2035-09-18'] }), extra({ hora_inicio: '25:00' }), extra({ hora_fim: '18:00' }), extra({ hora_fim: '17:59' }), extra({ tipo: 'inexistente' }), extra({ profissional_id: '1 OR 1=1' }), recurring({ dia_semana: 7 }), recurring({ dia_semana: -1 }), recurring({ duracao_minutos: 0 }), recurring({ duracao_minutos: 300 }), recurring({ intervalo_minutos: -1 }), recurring({ duracao_minutos: 30.5 })]) {
    const result = await request('/agenda/disponibilidades', { method: 'POST', body });
    assert.equal(result.status, 400, JSON.stringify({ body, response: result.data }));
  }
  for (const body of [block({ data: '2035-02-30' }), block({ hora_inicio: '15:50' }), block({ hora_fim: '14:59' }), block({ hora_inicio: '15:00:00' }), block({ motivo: {} })]) {
    const result = await request('/agenda/bloqueios', { method: 'POST', body });
    assert.equal(result.status, 400, JSON.stringify({ body, response: result.data }));
  }
  for (const resource of ['disponibilidades', 'bloqueios']) {
    for (const id of ['0', '-1', '1.5', '1%20OR%201=1', '9007199254740992']) assert.equal((await request(`/agenda/${resource}/${id}`, { method: 'DELETE' })).status, 400);
    assert.equal((await request(`/agenda/${resource}/999999`, { method: 'DELETE' })).status, 404);
  }
  for (const query of ['data=2035-02-30', `data=${date}&profissional_id=0`, `data=${date}&data=2035-09-19`]) assert.equal((await request('/agenda?' + query)).status, 400);
  assert.deepEqual((await publicSlots()).map((slot) => slot.horario), initialSlots);
});
