import test from 'node:test';
import assert from 'node:assert/strict';
import { toPostgresPlaceholders } from '../src/database.js';
import { createEmailVerification } from '../src/services/emailVerification.js';
import { createAppointmentNotifications } from '../src/services/appointmentNotifications.js';

test('converts positional placeholders while preserving quoted question marks', () => {
  assert.equal(
    toPostgresPlaceholders("SELECT '?' AS literal, id FROM pacientes WHERE email = ? AND ativo = ?"),
    "SELECT '?' AS literal, id FROM pacientes WHERE email = $1 AND ativo = $2",
  );
});

test('uses PostgreSQL ON CONFLICT for email verification state', async () => {
  const previousJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'postgres-compat-test-secret-not-for-production';
  const calls = [];
  const connection = {
    dialect: 'postgres',
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {},
    async query(sql) {
      calls.push(sql);
      if (sql.includes('FROM pacientes WHERE id')) return [[{ id: 7, ativo: 1, email: 'paciente@example.invalid', email_verificado_em: null }]];
      if (sql.includes('FROM verificacoes_email')) return [[]];
      return [{ affectedRows: 1 }];
    },
  };
  const database = { dialect: 'postgres', getConnection: async () => connection };
  try {
    const verification = createEmailVerification({ database, send: async () => {}, now: () => 1_700_000_000_000 });
    await verification.issue('paciente', 7);
    assert.match(calls.find((sql) => sql.startsWith('INSERT INTO verificacoes_email')), /ON CONFLICT \(perfil, usuario_id\)/);
  } finally {
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  }
});

test('uses PostgreSQL conflict handling and interval arithmetic for notifications', async () => {
  const calls = [];
  const database = {
    dialect: 'postgres',
    async query(sql) {
      calls.push(sql);
      if (sql.startsWith('WITH inserted')) return [[{ id: 12, inserted: true }]];
      if (sql.startsWith('SELECT id, tipo')) return [[{ id: 12, tipo: 'confirmacao', destinatario: 'paciente@example.test', status: 'pendente', tentativas: 0, dados: '{}' }]];
      return [{ affectedRows: 1 }];
    },
  };
  const notifications = createAppointmentNotifications({ database, send: async () => { throw new Error('offline'); } });
  const appointment = { id: 4, nome_cliente: 'Paciente Exemplo', email_cliente: 'paciente@example.test', inicio: '2035-09-18 09:00:00', fim: '2035-09-18 09:50:00', modalidade: 'online' };
  assert.equal((await notifications.queue(appointment, 'confirmacao')).queued, true);
  await notifications.deliver(12);
  assert.match(calls[0], /ON CONFLICT \(event_key\) DO NOTHING/);
  assert.match(calls.at(-1), /INTERVAL '1 minute'/);
});
