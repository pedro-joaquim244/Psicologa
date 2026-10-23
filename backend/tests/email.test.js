import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAppointmentEmail, buildLoginCodeEmail, sendEmailMessage } from '../src/services/email.js';

test('builds an accessible multipart confirmation email', () => {
  const message = buildLoginCodeEmail('123456');

  assert.equal(message.subject, 'Confirme seu e-mail — Helena Martins');
  assert.match(message.text, /código de confirmação é: 123456/);
  assert.match(message.text, /10 minutos/);
  assert.match(message.html, /<html lang="pt-BR">/);
  assert.match(message.html, /<meta name="viewport"/);
  assert.match(message.html, /role="presentation"/);
  assert.match(message.html, />\s*123456\s*</);
  assert.match(message.html, /Válido por 10 minutos/);
});

test('sends through the HTTPS provider without opening an SMTP connection', async (context) => {
  const previous = { provider: process.env.EMAIL_PROVIDER, key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM, fetch: globalThis.fetch };
  context.after(() => {
    if (previous.provider === undefined) delete process.env.EMAIL_PROVIDER; else process.env.EMAIL_PROVIDER = previous.provider;
    if (previous.key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previous.key;
    if (previous.from === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = previous.from;
    globalThis.fetch = previous.fetch;
  });
  process.env.EMAIL_PROVIDER = 'resend';
  process.env.RESEND_API_KEY = 're_ficticia_para_teste';
  process.env.EMAIL_FROM = 'Teste <nao-responda@example.invalid>';
  let request;
  globalThis.fetch = async (...args) => {
    request = args;
    return { ok: true, status: 200, json: async () => ({ id: 'email_ficticio_123' }) };
  };

  const result = await sendEmailMessage('paciente@example.invalid', { subject: 'Teste', text: 'Texto', html: '<p>Texto</p>' });

  assert.equal(request[0], 'https://api.resend.com/emails');
  assert.equal(request[1].method, 'POST');
  assert.deepEqual(JSON.parse(request[1].body).to, ['paciente@example.invalid']);
  assert.deepEqual(result, { provider: 'resend', id: 'email_ficticio_123' });
});

test('does not mark an ambiguous Resend response as sent', async (context) => {
  const previous = { provider: process.env.EMAIL_PROVIDER, key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM, fetch: globalThis.fetch };
  context.after(() => {
    if (previous.provider === undefined) delete process.env.EMAIL_PROVIDER; else process.env.EMAIL_PROVIDER = previous.provider;
    if (previous.key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previous.key;
    if (previous.from === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = previous.from;
    globalThis.fetch = previous.fetch;
  });
  process.env.EMAIL_PROVIDER = 'resend';
  process.env.RESEND_API_KEY = 're_ficticia_para_teste';
  process.env.EMAIL_FROM = 'Teste <nao-responda@example.invalid>';
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });

  await assert.rejects(
    sendEmailMessage('paciente@example.invalid', { subject: 'Teste', text: 'Texto', html: '<p>Texto</p>' }),
    /RESEND_CONFIRMATION_MISSING/,
  );
});

test('escapes dynamic content before placing it in HTML', () => {
  const message = buildLoginCodeEmail('<script>alert("x")</script>');

  assert.doesNotMatch(message.html, /<script>alert/);
  assert.match(message.html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(message.text, /<script>alert\("x"\)<\/script>/);
});

test('builds a discreet branded appointment notification without clinical data', () => {
  const message = buildAppointmentEmail('confirmacao', {
    nome: 'Marina <Oliveira>', inicio: '2035-09-18 14:00:00', fim: '2035-09-18 14:50:00', modalidade: 'online', profissionalNome: 'Dra. Helena Martins',
  });
  assert.match(message.subject, /Consulta confirmada/);
  assert.match(message.text, /18 de setembro de 2035.*14:00/);
  assert.match(message.html, /Ol&aacute;|Olá/);
  assert.match(message.html, /Marina &lt;Oliveira&gt;/);
  assert.match(message.html, /Modalidade: Online/);
  assert.match(message.html, /não contém informações clínicas/);
  assert.doesNotMatch(message.html, /diagnóstico|prontuário/i);
});
