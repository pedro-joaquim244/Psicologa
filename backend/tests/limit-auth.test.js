import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  MemoryRateLimitStore,
  RATE_LIMIT_CODE,
  authenticatedUserKey,
  createRateLimiter,
  createRateLimitStore,
  rateLimitPolicies,
} from '../src/middlewares/limitAuth.js';

async function startLimiter(options, configure = null) {
  const app = express();
  if (configure) configure(app);
  else app.post('/auth', createRateLimiter(options), (_req, res) => res.status(204).end());
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

test('rate limiter returns headers and JSON 429, expires windows, and bounds memory', async () => {
  let time = 0;
  const limiter = await startLimiter({
    maxAttempts: 2,
    windowMs: 1_000,
    store: new MemoryRateLimitStore({ maxEntries: 2, now: () => time }),
    now: () => time,
    key: (req) => req.get('x-test-key'),
  });
  try {
    const request = (key) => fetch(`${limiter.origin}/auth`, { method: 'POST', headers: { 'x-test-key': key } });
    const first = await request('a');
    assert.equal(first.status, 204);
    assert.equal(first.headers.get('ratelimit-limit'), '2');
    assert.equal(first.headers.get('ratelimit-remaining'), '1');
    assert.equal(first.headers.get('ratelimit-reset'), '1');
    assert.equal(first.headers.get('ratelimit-policy'), '2;w=1');
    assert.equal((await request('a')).status, 204);
    const blocked = await request('a');
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('retry-after'), '1');
    assert.equal(blocked.headers.get('ratelimit-remaining'), '0');
    assert.deepEqual(await blocked.json(), {
      erro: 'Muitas requisições. Aguarde um momento e tente novamente.',
      codigo: RATE_LIMIT_CODE,
    });
    assert.equal((await request('b')).status, 204);
    assert.equal((await request('c')).status, 429);
    time = 1_001;
    assert.equal((await request('c')).status, 204);
  } finally {
    await limiter.close();
  }
});

test('login and general traffic have independent policies for the same client', async () => {
  let time = 0;
  const store = new MemoryRateLimitStore({ now: () => time });
  const limiter = await startLimiter({}, (app) => {
    app.get('/api/horarios', createRateLimiter({ name: 'global-test', max: 3, windowMs: 1_000, store, now: () => time }), (_req, res) => res.status(204).end());
    app.post('/api/auth/login', createRateLimiter({ name: 'login-test', max: 1, windowMs: 1_000, message: 'Login limitado.', store, now: () => time }), (_req, res) => res.status(204).end());
  });
  try {
    assert.equal((await fetch(`${limiter.origin}/api/horarios`)).status, 204);
    assert.equal((await fetch(`${limiter.origin}/api/auth/login`, { method: 'POST' })).status, 204);
    const blockedLogin = await fetch(`${limiter.origin}/api/auth/login`, { method: 'POST' });
    assert.equal(blockedLogin.status, 429);
    assert.deepEqual(await blockedLogin.json(), { erro: 'Login limitado.', codigo: RATE_LIMIT_CODE });
    assert.equal((await fetch(`${limiter.origin}/api/horarios`)).status, 204);
  } finally {
    await limiter.close();
  }
});

test('authenticated write limits are isolated by authenticated account', async () => {
  const limiter = await startLimiter({}, (app) => {
    app.use((req, _res, next) => {
      req.usuario = { id: Number(req.get('x-test-user')), tipo: 'paciente' };
      next();
    });
    app.post('/write', createRateLimiter({ name: 'write-test', max: 2, windowMs: 60_000, key: authenticatedUserKey }), (_req, res) => res.status(204).end());
  });
  try {
    const write = (user) => fetch(`${limiter.origin}/write`, { method: 'POST', headers: { 'x-test-user': user } });
    assert.equal((await write(1)).status, 204);
    assert.equal((await write(1)).status, 204);
    assert.equal((await write(1)).status, 429);
    assert.equal((await write(2)).status, 204);
  } finally {
    await limiter.close();
  }
});

test('production store configuration is explicit and policy defaults are conservative', () => {
  assert.equal(rateLimitPolicies.global.max, 180);
  assert.equal(rateLimitPolicies.login.max, 10);
  assert.equal(rateLimitPolicies.register.max, 5);
  assert.equal(rateLimitPolicies.resend.max, 5);
  assert.equal(rateLimitPolicies.booking.max, 20);
  assert.equal(rateLimitPolicies.write.max, 60);
  assert.ok(createRateLimitStore({ mode: 'memory' }) instanceof MemoryRateLimitStore);
  assert.throws(
    () => createRateLimitStore({ mode: 'upstash', url: '', token: '' }),
    /UPSTASH_REDIS_REST_URL/,
  );
});
