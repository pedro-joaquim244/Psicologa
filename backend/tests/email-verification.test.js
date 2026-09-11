import 'dotenv/config';
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import db from '../src/database.js';
import { createEmailVerification } from '../src/services/emailVerification.js';
import { autenticarToken } from '../src/middlewares/autenticacao.js';

// All writes use connection-scoped temporary tables; real accounts are untouched.
let connection;
let time;
let messages;
let deliveryFails;
let verification;
before(async () => {
  connection = await db.getConnection();
  for (const table of ['pacientes', 'usuarios_admin', 'verificacoes_email']) {
    const [[schema]] = await connection.query(`SHOW CREATE TABLE ${table}`);
    await connection.query(schema['Create Table'].replace('CREATE TABLE', 'CREATE TEMPORARY TABLE'));
  }
  const database = {
    query: (...args) => connection.query(...args),
    getConnection: async () => ({
      query: (...args) => connection.query(...args),
      beginTransaction: () => connection.beginTransaction(), commit: () => connection.commit(),
      rollback: () => connection.rollback(), release() {},
    }),
  };
  verification = createEmailVerification({ database, now: () => time, send: async (email, code) => {
    if (deliveryFails) throw new Error('SMTP unavailable');
    messages.push({ email, code });
  } });
});
beforeEach(async () => {
  for (const table of ['verificacoes_email', 'pacientes', 'usuarios_admin']) await connection.query(`DELETE FROM ${table}`);
  await connection.query("INSERT INTO pacientes (id, nome, email, telefone, senha, ativo) VALUES (1, 'Teste', 'teste@example.com', '11999999999', 'hash', 1)");
  time = Date.now(); messages = []; deliveryFails = false;
});
after(async () => {
  if (connection) {
    for (const table of ['verificacoes_email', 'pacientes', 'usuarios_admin']) await connection.query(`DROP TEMPORARY TABLE IF EXISTS ${table}`);
    connection.release();
  }
  await db.end();
});

test('sends six digits, stores only hash, issues token only once after verification', async () => {
  const challenge = await verification.issue('paciente', 1);
  assert.equal(challenge.token, undefined);
  assert.match(messages[0].code, /^\d{6}$/);
  const [[row]] = await connection.query('SELECT * FROM verificacoes_email');
  assert.notEqual(row.codigo_hash, messages[0].code);
  const [[before]] = await connection.query('SELECT email_verificado_em FROM pacientes WHERE id = 1');
  assert.equal(before.email_verificado_em, null);
  const session = await verification.verify('paciente', challenge.desafio, messages[0].code);
  assert.equal(jwt.verify(session.token, process.env.JWT_SECRET).email_verificado, true);
  const [[after]] = await connection.query('SELECT email_verificado_em FROM pacientes WHERE id = 1');
  assert.ok(after.email_verificado_em);
  await assert.rejects(verification.verify('paciente', challenge.desafio, messages[0].code), /não está mais disponível/);
});

test('wrong codes persist attempts and lock out verification and resend', async () => {
  const challenge = await verification.issue('paciente', 1);
  const wrong = messages[0].code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) await assert.rejects(verification.verify('paciente', challenge.desafio, wrong), /incorreto/);
  await assert.rejects(verification.verify('paciente', challenge.desafio, messages[0].code), /Limite/);
  time += 61000;
  await assert.rejects(verification.resend('paciente', challenge.desafio), /Limite/);
  await assert.rejects(verification.issue('paciente', 1), /Limite/);
});

test('professional access also requires verification and records the confirmed email', async () => {
  await connection.query("INSERT INTO usuarios_admin (id, nome, email, senha, tipo, ativo) VALUES (1, 'Profissional teste', 'profissional@example.com', 'hash', 'psicologa', 1)");
  const challenge = await verification.issue('profissional', 1);
  assert.equal(challenge.token, undefined);
  assert.equal(messages[0].email, 'profissional@example.com');
  const session = await verification.verify('profissional', challenge.desafio, messages[0].code);
  const claims = jwt.verify(session.token, process.env.JWT_SECRET);
  assert.equal(claims.tipo, 'psicologa');
  assert.equal(claims.email_verificado, true);
  const [[user]] = await connection.query('SELECT email_verificado_em FROM usuarios_admin WHERE id = 1');
  assert.ok(user.email_verificado_em);
});

test('resend invalidates old challenge, preserves attempts and respects cooldown', async () => {
  const first = await verification.issue('paciente', 1);
  const oldCode = messages[0].code;
  await assert.rejects(verification.resend('paciente', first.desafio), /Aguarde um minuto/);
  const wrong = oldCode === '000000' ? '111111' : '000000';
  await assert.rejects(verification.verify('paciente', first.desafio, wrong), /incorreto/);
  time += 61000;
  const next = await verification.resend('paciente', first.desafio);
  assert.notEqual(first.desafio, next.desafio);
  const [[row]] = await connection.query('SELECT tentativas FROM verificacoes_email');
  assert.equal(row.tentativas, 1);
  await assert.rejects(verification.verify('paciente', first.desafio, oldCode), /não está mais disponível/);
  await verification.verify('paciente', next.desafio, messages[1].code);
});

test('rejects expired, wrong audience, inactive accounts and changed email', async () => {
  const challenge = await verification.issue('paciente', 1);
  await assert.rejects(verification.verify('profissional', challenge.desafio, messages[0].code), /não está mais disponível/);
  time += 600001;
  await assert.rejects(verification.verify('paciente', challenge.desafio, messages[0].code), /expirado/);
  time -= 600001;
  await connection.query("UPDATE pacientes SET email = 'outro@example.com' WHERE id = 1");
  await assert.rejects(verification.verify('paciente', challenge.desafio, messages[0].code), /não está mais disponível/);
  await connection.query("UPDATE pacientes SET email = 'teste@example.com', ativo = 0 WHERE id = 1");
  await assert.rejects(verification.verify('paciente', challenge.desafio, messages[0].code), /não está mais disponível/);
});

test('SMTP failure rolls back challenge, allowing retry without bypass', async () => {
  deliveryFails = true;
  await assert.rejects(verification.issue('paciente', 1), error => error.status === 503);
  const [[row]] = await connection.query('SELECT COUNT(*) AS total FROM verificacoes_email');
  assert.equal(row.total, 0);
  deliveryFails = false;
  await verification.issue('paciente', 1);
  assert.equal(messages.length, 1);
});

test('send limits survive new logins and reset after the window', async () => {
  for (let i = 0; i < 5; i++) { await verification.issue('paciente', 1); time += 61000; }
  await assert.rejects(verification.issue('paciente', 1), /Limite/);
  time += 15 * 60000;
  await verification.issue('paciente', 1);
});

test('legacy password-only tokens cannot access authenticated routes', () => {
  const token = jwt.sign({ id: 1, tipo: 'paciente' }, process.env.JWT_SECRET);
  let status;
  let continued = false;
  const res = { status(value) { status = value; return this; }, json() {} };
  autenticarToken({ headers: { authorization: `Bearer ${token}` } }, res, () => { continued = true; });
  assert.equal(status, 401);
  assert.equal(continued, false);
});
