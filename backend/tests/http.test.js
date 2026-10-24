import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import db from '../src/database.js';
let server, origin;
before(async () => {
  const app = createApp({ production: true, frontendUrl: 'https://consultorio.example,http://localhost:5173' });
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve)); await db.end(); });
test('CORS autoriza origens exatas e não ecoa origens arbitrárias', async () => {
  for (const source of ['https://consultorio.example', 'http://localhost:5173', 'https://consultorio.example.evil.test']) {
    const response = await fetch(origin, { headers: { Origin: source } });
    assert.equal(response.headers.get('access-control-allow-origin'), source.endsWith('evil.test') ? null : source);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
    assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
  }
});
test('database diagnostic is not exposed in production', async () => {
  const response = await fetch(origin + '/api/teste-banco');
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { erro: 'Rota não encontrada.' });
});
test('demo mode exposes only safe flags and blocks public registration before database access', async (context) => {
  const names = ['DEMO_MODE', 'DEMO_PUBLIC_LOGIN', 'PUBLIC_REGISTRATION_ENABLED', 'EMAIL_PROVIDER'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  context.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  process.env.DEMO_MODE = 'true';
  process.env.DEMO_PUBLIC_LOGIN = 'true';
  process.env.PUBLIC_REGISTRATION_ENABLED = 'true';
  process.env.EMAIL_PROVIDER = 'resend';

  const configResponse = await fetch(origin + '/api/config');
  assert.equal(configResponse.status, 200);
  assert.deepEqual(await configResponse.json(), {
    demoMode: true,
    emailDelivery: false,
    publicRegistration: false,
    demoAccess: { paciente: true, profissional: true },
  });
  const registration = await fetch(origin + '/api/pacientes/cadastro', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'Cadastro Bloqueado', email: 'novo@example.invalid', telefone: '11900000000', senha: 'SenhaTeste123!' }),
  });
  assert.equal(registration.status, 503);
  assert.equal((await registration.json()).codigo, 'CADASTRO_INDISPONIVEL');
});
test('preflight permite excluir horários com Authorization a partir do frontend autorizado', async () => {
  const response = await fetch(origin + '/api/agenda/bloqueios/1', {
    method: 'OPTIONS',
    headers: { Origin: 'https://consultorio.example', 'Access-Control-Request-Method': 'DELETE', 'Access-Control-Request-Headers': 'authorization,content-type' },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://consultorio.example');
  assert.ok(response.headers.get('access-control-allow-methods').split(',').includes('DELETE'));
  assert.match(response.headers.get('access-control-allow-headers').toLowerCase(), /authorization/);
});
test('JSON inválido, payload grande e rota inexistente retornam erro JSON sem stack', async () => {
  for (const [path, body, status] of [['/api/auth/login', '{', 400], ['/api/auth/login', JSON.stringify({ senha: 'x'.repeat(40000) }), 413], ['/api/inexistente', '{}', 404]]) {
    const response = await fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(response.status, status);
    const result = await response.json();
    assert.deepEqual(Object.keys(result), ['erro']);
  }
});
