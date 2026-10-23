import db from '../database.js';
import { sendAppointmentEmail } from './email.js';

const MAX_ATTEMPTS = 3;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const eventTypes = new Set(['solicitacao', 'confirmacao', 'conclusao', 'cancelamento', 'reagendamento', 'recusa']);

function validRecipient(email) {
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
  return normalized.length <= 255
    && emailPattern.test(normalized)
    && !normalized.endsWith('@example.invalid');
}

function snapshot(appointment) {
  return {
    nome: String(appointment.nome_cliente || '').slice(0, 150),
    inicio: appointment.inicio,
    fim: appointment.fim,
    modalidade: appointment.modalidade === 'presencial' ? 'presencial' : 'online',
    profissionalNome: String(appointment.profissional_nome || 'Helena Martins').slice(0, 150),
  };
}

function eventKey(appointment, type) {
  // Reagendamentos podem ocorrer mais de uma vez. Os demais eventos são únicos
  // por consulta e não devem ser reenviados quando uma requisição é repetida.
  const schedule = type === 'reagendamento' ? `:${appointment.inicio}:${appointment.fim}` : '';
  return `${appointment.id}:${type}${schedule}`;
}

function safeError(error) {
  const code = String(error?.code || error?.message || 'EMAIL_PROVIDER_FAILED');
  return code.replace(/[^A-Z0-9_:-]/gi, '_').slice(0, 180) || 'EMAIL_PROVIDER_FAILED';
}

export function createAppointmentNotifications({ database = db, send = sendAppointmentEmail, now = () => new Date() } = {}) {
  async function queue(appointment, type) {
    if (!eventTypes.has(type)) throw new Error('INVALID_NOTIFICATION_EVENT');
    const recipient = String(appointment?.email_cliente || '').trim().toLowerCase();
    const status = validRecipient(recipient) ? 'pendente' : 'invalido';
    const error = status === 'invalido' ? 'INVALID_RECIPIENT' : null;
    const key = eventKey(appointment, type);
    const details = JSON.stringify(snapshot(appointment));
    if (database.dialect === 'postgres') {
      const [rows] = await database.query(
        `WITH inserted AS (
           INSERT INTO notificacoes_agendamento
             (agendamento_id, tipo, destinatario, status, event_key, dados, ultima_tentativa_em, enviado_em, proxima_tentativa_em, erro)
           VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, CASE WHEN ? = 'pendente' THEN CURRENT_TIMESTAMP ELSE NULL END, ?)
           ON CONFLICT (event_key) DO NOTHING
           RETURNING id
         )
         SELECT id, TRUE AS inserted FROM inserted
         UNION ALL
         SELECT id, FALSE AS inserted FROM notificacoes_agendamento WHERE event_key = ?
         LIMIT 1`,
        [appointment.id, type, recipient || null, status, key, details, status, error, key],
      );
      return { id: rows[0]?.id, queued: rows[0]?.inserted === true && status === 'pendente', status };
    }
    const [result] = await database.query(
      `INSERT INTO notificacoes_agendamento
        (agendamento_id, tipo, destinatario, status, event_key, dados, ultima_tentativa_em, enviado_em, proxima_tentativa_em, erro)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, CASE WHEN ? = 'pendente' THEN CURRENT_TIMESTAMP ELSE NULL END, ?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [appointment.id, type, recipient || null, status, key, details, status, error],
    );
    return { id: result.insertId, queued: result.affectedRows === 1 && status === 'pendente', status };
  }

  async function deliver(id) {
    const [[notification]] = await database.query(
      `SELECT id, tipo, destinatario, status, tentativas, dados
       FROM notificacoes_agendamento
       WHERE id = ? AND status IN ('pendente', 'falhou')
         AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em <= CURRENT_TIMESTAMP)
       LIMIT 1`,
      [id],
    );
    if (!notification) return { delivered: false, reason: 'NOT_DUE' };

    const attempts = Number(notification.tentativas || 0) + 1;
    const [claim] = await database.query(
      `UPDATE notificacoes_agendamento
       SET status = 'enviando', tentativas = ?, ultima_tentativa_em = CURRENT_TIMESTAMP, erro = NULL
       WHERE id = ? AND status IN ('pendente', 'falhou')`,
      [attempts, id],
    );
    if (!claim.affectedRows) return { delivered: false, reason: 'CLAIMED' };

    try {
      const details = typeof notification.dados === 'string' ? JSON.parse(notification.dados) : notification.dados;
      await send(notification.destinatario, notification.tipo, details);
      await database.query(
        `UPDATE notificacoes_agendamento
         SET status = 'enviado', enviado_em = CURRENT_TIMESTAMP, proxima_tentativa_em = NULL, erro = NULL
         WHERE id = ?`,
        [id],
      );
      return { delivered: true };
    } catch (error) {
      const retry = attempts < MAX_ATTEMPTS;
      const retryMinutes = Math.min(60, 5 * (2 ** Math.max(0, attempts - 1)));
      const retryExpression = database.dialect === 'postgres'
        ? "CURRENT_TIMESTAMP + (?::integer * INTERVAL '1 minute')"
        : 'DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE)';
      await database.query(
        `UPDATE notificacoes_agendamento
         SET status = ?, erro = ?, proxima_tentativa_em = ${retry ? retryExpression : 'NULL'}
         WHERE id = ?`,
        retry ? ['falhou', safeError(error), retryMinutes, id] : ['falhou', safeError(error), id],
      );
      return { delivered: false, reason: 'SEND_FAILED' };
    }
  }

  async function retryDue(limit = 20) {
    const safeLimit = Number.isInteger(limit) ? Math.max(1, Math.min(limit, 100)) : 20;
    const [rows] = await database.query(
      `SELECT id FROM notificacoes_agendamento
       WHERE status IN ('pendente', 'falhou')
         AND tentativas < ?
         AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em <= CURRENT_TIMESTAMP)
       ORDER BY id ASC LIMIT ${safeLimit}`,
      [MAX_ATTEMPTS],
    );
    return Promise.all(rows.map((row) => deliver(row.id)));
  }

  return { queue, deliver, retryDue, now };
}

export const appointmentNotifications = createAppointmentNotifications();

export function dispatchAppointmentNotification(notification) {
  if (!notification?.id || !notification.queued || notification.status !== 'pendente') return;
  void appointmentNotifications.deliver(notification.id).catch(() => {
    // A tentativa e a falha ficam registradas na fila. Não registrar destinatários.
  });
}
