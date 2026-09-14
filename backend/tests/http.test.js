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
  }
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
