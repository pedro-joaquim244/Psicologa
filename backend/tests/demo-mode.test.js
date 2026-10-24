import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { emailDeliveryEnabled, publicDemoLoginEnabled, publicRegistrationEnabled, publicRuntimeConfig } from '../src/config/runtime.js';
import { createDemoSession } from '../src/services/demoAccess.js';

function preserveEnvironment(context, names) {
  const values = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  context.after(() => {
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

test('demo mode disables external email and public registration', (context) => {
  preserveEnvironment(context, ['DEMO_MODE', 'DEMO_PUBLIC_LOGIN', 'PUBLIC_REGISTRATION_ENABLED', 'EMAIL_PROVIDER']);
  process.env.DEMO_MODE = 'true';
  process.env.DEMO_PUBLIC_LOGIN = 'true';
  process.env.PUBLIC_REGISTRATION_ENABLED = 'false';
  process.env.EMAIL_PROVIDER = 'disabled';

  assert.equal(emailDeliveryEnabled(), false);
  assert.equal(publicRegistrationEnabled(), false);
  assert.equal(publicDemoLoginEnabled(), true);
  assert.deepEqual(publicRuntimeConfig(), {
    demoMode: true,
    emailDelivery: false,
    publicRegistration: false,
    demoAccess: { paciente: true, profissional: true },
  });
});

test('demo session uses only an active verified fictitious account', async (context) => {
  preserveEnvironment(context, ['DEMO_MODE', 'DEMO_PUBLIC_LOGIN', 'DEMO_PATIENT_EMAIL', 'JWT_SECRET']);
  process.env.DEMO_MODE = 'true';
  process.env.DEMO_PUBLIC_LOGIN = 'true';
  process.env.DEMO_PATIENT_EMAIL = 'paciente.demo@example.invalid';
  process.env.JWT_SECRET = 'segredo-ficticio-de-teste-com-mais-de-32-bytes';
  const calls = [];
  const database = {
    async query(sql, params) {
      calls.push({ sql, params });
      return [[{
        id: 81,
        nome: 'Paciente Demonstração',
        email: 'paciente.demo@example.invalid',
        telefone: '11900000000',
        ativo: 1,
        email_verificado_em: '2030-01-01 10:00:00',
      }]];
    },
  };

  const session = await createDemoSession('paciente', database);
  const claims = jwt.verify(session.token, process.env.JWT_SECRET);
  assert.equal(session.usuario.email_verificado, true);
  assert.equal(claims.tipo, 'paciente');
  assert.equal(calls[0].params[0], 'paciente.demo@example.invalid');
  assert.match(calls[0].sql, /ativo = 1 AND email_verificado_em IS NOT NULL/);
});
