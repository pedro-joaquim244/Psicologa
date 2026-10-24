import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppointmentNotifications } from '../src/services/appointmentNotifications.js';

function databaseFor(notification) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.startsWith('INSERT INTO notificacoes')) return [{ insertId: 41, affectedRows: 1 }];
      if (sql.startsWith('SELECT id, tipo')) return [[notification]];
      return [{ affectedRows: 1 }];
    },
  };
}

const appointment = { id: 8, nome_cliente: 'Paciente de teste', email_cliente: 'paciente@example.com', inicio: '2035-09-18 14:00:00', fim: '2035-09-18 14:50:00', modalidade: 'online', profissional_nome: 'Helena Martins' };

test('persists a notification event and delivers its immutable snapshot', async () => {
  const database = databaseFor({ id: 41, tipo: 'confirmacao', destinatario: appointment.email_cliente, status: 'pendente', tentativas: 0, dados: JSON.stringify({ nome: appointment.nome_cliente, inicio: appointment.inicio, fim: appointment.fim, modalidade: appointment.modalidade, profissionalNome: appointment.profissional_nome }) });
  const sent = [];
  const notifications = createAppointmentNotifications({ database, send: async (...args) => sent.push(args) });
  const queued = await notifications.queue(appointment, 'confirmacao');
  assert.deepEqual(queued, { id: 41, queued: true, status: 'pendente' });
  assert.equal(await notifications.deliver(41).then((result) => result.delivered), true);
  assert.deepEqual(sent[0], ['paciente@example.com', 'confirmacao', { nome: 'Paciente de teste', inicio: '2035-09-18 14:00:00', fim: '2035-09-18 14:50:00', modalidade: 'online', profissionalNome: 'Helena Martins' }]);
  assert.match(database.calls[0].params[4], /^8:confirmacao$/);
});

test('marks an invalid recipient without calling the provider', async () => {
  const database = databaseFor(null);
  const notifications = createAppointmentNotifications({ database, send: async () => { throw new Error('must not send'); } });
  const queued = await notifications.queue({ ...appointment, email_cliente: 'endereço inválido' }, 'cancelamento');
  assert.deepEqual(queued, { id: 41, queued: false, status: 'invalido' });
  assert.equal(database.calls.length, 1);
  assert.equal(database.calls[0].params.at(-1), 'INVALID_RECIPIENT');
});

test('never sends demonstration notifications to the reserved invalid domain', async () => {
  const database = databaseFor(null);
  const notifications = createAppointmentNotifications({ database, send: async () => { throw new Error('must not send'); } });
  const queued = await notifications.queue({ ...appointment, email_cliente: 'paciente.demo@example.invalid' }, 'confirmacao');
  assert.deepEqual(queued, { id: 41, queued: false, status: 'invalido' });
  assert.equal(database.calls.length, 1);
});

test('marks notifications as disabled without contacting a provider in demo mode', async (context) => {
  const previous = process.env.DEMO_MODE;
  context.after(() => { if (previous === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = previous; });
  process.env.DEMO_MODE = 'true';
  const database = databaseFor(null);
  const notifications = createAppointmentNotifications({ database, send: async () => { throw new Error('must not send'); } });
  const queued = await notifications.queue(appointment, 'confirmacao');
  assert.deepEqual(queued, { id: 41, queued: false, status: 'invalido' });
  assert.equal(database.calls.length, 1);
  assert.equal(database.calls[0].params.at(-1), 'EMAIL_DELIVERY_DISABLED');
});

test('records provider failures for a later retry without affecting the appointment', async () => {
  const database = databaseFor({ id: 41, tipo: 'confirmacao', destinatario: appointment.email_cliente, status: 'pendente', tentativas: 0, dados: JSON.stringify({}) });
  const notifications = createAppointmentNotifications({ database, send: async () => { const error = new Error('offline'); error.code = 'ETIMEDOUT'; throw error; } });
  assert.deepEqual(await notifications.deliver(41), { delivered: false, reason: 'SEND_FAILED' });
  const failure = database.calls.at(-1);
  assert.equal(failure.params[0], 'falhou');
  assert.equal(failure.params[1], 'ETIMEDOUT');
});
