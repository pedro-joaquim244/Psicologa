import 'dotenv/config';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import express from 'express';
import db from '../src/database.js';
import appointments from '../src/routes/agendamentos.routes.js';
import agenda from '../src/routes/agenda.routes.js';
import { ensureAgendaSchema } from '../src/services/agendaSchema.js';

// Uma base descartável compartilhada entre conexões independentes é necessária
// para testar locks reais. Copiamos somente DDL, nunca contas ou consultas reais.
const schema = `agenda_test_${randomBytes(8).toString('hex')}`;
const original = { query: db.query, getConnection: db.getConnection };
let pool, server, origin, created = false;
before(async () => {
  await db.query(`CREATE DATABASE \`${schema}\``);
  created = true;
  pool = mysql.createPool({ host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: schema, connectionLimit: 10, dateStrings: true });
  for (const table of ['profissionais', 'usuarios_admin', 'pacientes', 'disponibilidades', 'bloqueios_agenda', 'agendamentos']) {
    const [[ddl]] = await original.query.call(db, `SHOW CREATE TABLE ${table}`);
    const sql = ddl['Create Table'].split('\n').filter(line => !line.trim().startsWith('CONSTRAINT ')).join('\n').replace(/,\n\)/, '\n)');
    await pool.query(sql);
  }
  await ensureAgendaSchema(pool);
  await pool.query("INSERT INTO profissionais (id, nome, ativo) VALUES (1, 'Teste de concorrência', 1)");
  await pool.query("INSERT INTO usuarios_admin (id, nome, email, senha, tipo, ativo, email_verificado_em) VALUES (1, 'Profissional teste', 'psicologa@example.com', 'hash', 'psicologa', 1, NOW())");
  await pool.query("INSERT INTO pacientes (id, nome, email, telefone, senha, ativo, email_verificado_em) VALUES (1, 'Teste A', 'a@example.com', '11999999999', 'hash', 1, NOW()), (2, 'Teste B', 'b@example.com', '11999999999', 'hash', 1, NOW())");
  // Duas janelas válidas cujos slots podem se sobrepor sem o mesmo início.
  await pool.query("INSERT INTO disponibilidades (profissional_id, dia_semana, hora_inicio, hora_fim, duracao_minutos, intervalo_minutos, ativo) VALUES (1, 2, '09:00', '12:00', 50, 10, 1), (1, 2, '09:30', '12:00', 50, 10, 1)");
  db.query = (...args) => pool.query(...args);
  db.getConnection = () => pool.getConnection();
  const app = express(); app.use(express.json()); app.use('/api/agendamentos', appointments); app.use('/api/agenda', agenda);
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve));
  db.query = original.query; db.getConnection = original.getConnection;
  await pool?.end();
  // Nunca aceitar nome configurável para DROP. Somente a base aleatória criada aqui.
  if (created && /^agenda_test_[a-f0-9]{16}$/.test(schema)) await db.query(`DROP DATABASE \`${schema}\``);
  await db.end();
});
async function book(id, horario) {
  const token = jwt.sign({ id, tipo: 'paciente', email: id === 1 ? 'a@example.com' : 'b@example.com', email_verificado: true }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return fetch(origin + '/api/agendamentos', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: '2035-09-18', horario, modalidade: 'online' }) });
}
async function createWindow(resource, body) {
  const token = jwt.sign({ id: 1, tipo: 'psicologa', email: 'psicologa@example.com', email_verificado: true }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return fetch(`${origin}/api/agenda/${resource}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ profissional_id: 1, data: '2035-09-18', ...body }) });
}
test('requisições simultâneas em conexões MySQL distintas reservam uma única vez', async () => {
  const results = await Promise.all(Array.from({ length: 8 }, (_, index) => book(index % 2 + 1, '09:00')));
  assert.equal(results.filter(result => result.status === 201).length, 1);
  assert.equal(results.filter(result => result.status === 409).length, 7);
  const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM agendamentos');
  assert.equal(row.total, 1);
});
test('inícios diferentes também não podem produzir intervalos ativos sobrepostos', async () => {
  await pool.query('DELETE FROM agendamentos');
  const results = await Promise.all([book(1, '09:00'), book(2, '09:30')]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  assert.equal((await book(1, '11:00')).status, 201);
});

test('reserva e bloqueio simultâneos nunca ocupam o mesmo intervalo', async () => {
  await pool.query('DELETE FROM agendamentos');
  const results = await Promise.all([
    book(1, '09:00'),
    createWindow('bloqueios', { hora_inicio: '09:00', hora_fim: '09:50', motivo: 'Bloqueio concorrente' }),
  ]);
  assert.deepEqual(results.map((response) => response.status).sort(), [201, 409]);
  const [[appointments]] = await pool.query('SELECT COUNT(*) AS total FROM agendamentos');
  const [[blocks]] = await pool.query('SELECT COUNT(*) AS total FROM bloqueios_agenda');
  assert.equal(appointments.total + blocks.total, 1);
});

test('extras sobrepostos criados simultaneamente produzem uma única disponibilidade', async () => {
  const results = await Promise.all([
    createWindow('disponibilidades', { tipo: 'extra', hora_inicio: '18:00', hora_fim: '18:50' }),
    createWindow('disponibilidades', { tipo: 'extra', hora_inicio: '18:30', hora_fim: '19:20' }),
  ]);
  assert.deepEqual(results.map((response) => response.status).sort(), [201, 409]);
  const [[extras]] = await pool.query('SELECT COUNT(*) AS total FROM disponibilidades WHERE data_especifica IS NOT NULL');
  assert.equal(extras.total, 1);
});
