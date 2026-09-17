import 'dotenv/config';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../src/database.js';
import patientRoutes from '../src/routes/pacientes.routes.js';
import authRoutes from '../src/routes/auth.routes.js';
import { createEmailVerification, emailVerification } from '../src/services/emailVerification.js';

const original = { query: db.query, getConnection: db.getConnection, ...emailVerification };
let connection, server, origin;
const messages = [];
before(async () => {
  connection = await db.getConnection();
  for (const table of ['pacientes', 'usuarios_admin', 'verificacoes_email']) {
    const [[ddl]] = await connection.query('SHOW CREATE TABLE ' + table);
    await connection.query(ddl['Create Table'].replace('CREATE TABLE', 'CREATE TEMPORARY TABLE'));
  }
  db.query = (...args) => connection.query(...args);
  db.getConnection = async () => ({ query: (...args) => connection.query(...args), beginTransaction: () => connection.beginTransaction(), commit: () => connection.commit(), rollback: () => connection.rollback(), release() {} });
  Object.assign(emailVerification, createEmailVerification({ database: db, send: async (email, code) => messages.push({ email, code }) }));
  const app = express(); app.use(express.json()); app.use('/pacientes', patientRoutes); app.use('/auth', authRoutes);
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve));
  db.query = original.query; db.getConnection = original.getConnection;
  for (const key of ['issue', 'pending', 'verify', 'resend']) emailVerification[key] = original[key];
  connection?.destroy(); await db.end();
});
async function post(path, body) {
  const response = await fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
test('paciente confirma no cadastro e os próximos logins geram JWT sem novo código', async () => {
  const details = { nome: 'Paciente Teste', email: 'paciente@example.com', telefone: '11999999999', senha: 'SenhaTeste123!' };
  const created = await post('/pacientes/cadastro', details);
  assert.equal(created.status, 201); assert.equal(created.body.token, undefined);
  const [[stored]] = await connection.query('SELECT senha FROM pacientes');
  assert.notEqual(stored.senha, details.senha); assert.equal(await bcrypt.compare(details.senha, stored.senha), true);
  const blocked = await post('/pacientes/login', details);
  assert.equal(blocked.status, 403); assert.equal(blocked.body.codigo, 'EMAIL_NAO_VERIFICADO');
  assert.equal(blocked.body.desafio, created.body.desafio); assert.equal(messages.length, 1);
  const verified = await post('/pacientes/verificar-email', { desafio: created.body.desafio, codigo: messages.at(-1).code });
  assert.equal(verified.status, 200); assert.equal(verified.body.usuario.senha, undefined);
  const me = await fetch(origin + '/pacientes/me', { headers: { Authorization: 'Bearer ' + verified.body.token } });
  assert.equal(me.status, 200); assert.equal((await me.json()).usuario.email, details.email);
  assert.equal((await post('/pacientes/cadastro', details)).status, 409);
  assert.equal((await post('/pacientes/login', { email: details.email, senha: 'incorreta' })).status, 401);
  const login = await post('/pacientes/login', details);
  assert.equal(login.status, 200); assert.ok(login.body.token); assert.equal(login.body.usuario.tipo, 'paciente');
  assert.equal(login.body.usuario.senha, undefined); assert.equal(messages.length, 1);
});
test('profissional não verificado reenvia sob demanda e depois entra direto sem expor hash', async () => {
  const email = 'profissional@example.com'; const senha = 'SenhaProfissional123!';
  await connection.query("INSERT INTO usuarios_admin (nome, email, senha, tipo) VALUES ('Profissional teste', ?, ?, 'psicologa')", [email, await bcrypt.hash(senha, 12)]);
  assert.equal((await post('/auth/login', { email, senha: 'incorreta' })).status, 401);
  const login = await post('/auth/login', { email, senha });
  assert.equal(login.status, 403); assert.equal(login.body.codigo, 'EMAIL_NAO_VERIFICADO'); assert.equal(messages.length, 1);
  const challenge = await post('/auth/reenviar-codigo', { email, senha });
  assert.equal(challenge.status, 200); assert.equal(messages.length, 2);
  const verified = await post('/auth/verificar-email', { desafio: challenge.body.desafio, codigo: messages.at(-1).code });
  assert.equal(verified.status, 200); assert.equal(verified.body.usuario.tipo, 'psicologa'); assert.equal(verified.body.usuario.senha, undefined);
  const nextLogin = await post('/auth/login', { email, senha });
  assert.equal(nextLogin.status, 200); assert.ok(nextLogin.body.token); assert.equal(messages.length, 2);
  assert.equal((await post('/auth/reenviar-codigo', { email, senha })).status, 409);
});
test('contas inativas continuam bloqueadas como credenciais inválidas', async () => {
  const senha = 'SenhaInativa123!';
  await connection.query("INSERT INTO pacientes (nome, email, telefone, senha, ativo, email_verificado_em) VALUES ('Inativa', 'inativa@example.com', '11999998888', ?, 0, NOW())", [await bcrypt.hash(senha, 12)]);
  await connection.query("INSERT INTO usuarios_admin (nome, email, senha, tipo, ativo, email_verificado_em) VALUES ('Inativo', 'admin-inativo@example.com', ?, 'admin', 0, NOW())", [await bcrypt.hash(senha, 12)]);
  assert.equal((await post('/pacientes/login', { email: 'inativa@example.com', senha })).status, 401);
  assert.equal((await post('/auth/login', { email: 'admin-inativo@example.com', senha })).status, 401);
});
