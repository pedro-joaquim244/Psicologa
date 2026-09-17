import { createHmac, randomInt, randomBytes, timingSafeEqual } from 'node:crypto';
import db from '../database.js';
import { sendLoginCode } from './email.js';
import { createAuthenticatedSession } from './authentication.js';

const tables = { paciente: 'pacientes', profissional: 'usuarios_admin' };
const MAX_EMAIL_SENDS_PER_WINDOW = 3;
const MAX_CODE_ATTEMPTS_PER_WINDOW = 5;
const fail = (status, message, retryAfter) => Object.assign(new Error(message), { status, retryAfter });
const digest = (id, code) => createHmac('sha256', process.env.JWT_SECRET).update(`${id}:${code}`).digest('hex');
export function createEmailVerification({ database = db, send = sendLoginCode, now = Date.now } = {}) {
  async function transaction(action) {
    const connection = await database.getConnection();
    try {
      await connection.beginTransaction();
      const result = await action(connection);
      await connection.commit();
      if (result instanceof Error) throw result;
      return result;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  async function issue(kind, userId, previousId) {
    if (!tables[kind]) throw fail(400, 'Acesso inválido.');
    return transaction(async (connection) => {
      const [[user]] = await connection.query(`SELECT * FROM ${tables[kind]} WHERE id = ? FOR UPDATE`, [userId]);
      if (!user?.ativo) throw fail(401, 'Entre novamente para solicitar um código.');
      if (user.email_verificado_em) throw fail(409, 'Este e-mail já foi confirmado. Entre normalmente com sua senha.');
      const [[old]] = await connection.query('SELECT * FROM verificacoes_email WHERE perfil = ? AND usuario_id = ? FOR UPDATE', [kind, userId]);
      if (previousId && (!old || old.desafio !== previousId || old.consumido)) throw fail(400, 'Esta verificação não está mais disponível. Entre novamente.');
      const time = now();
      const activeWindow = old && Number(old.janela_ate) > time;
      if (activeWindow && (old.envios >= MAX_EMAIL_SENDS_PER_WINDOW || old.tentativas >= MAX_CODE_ATTEMPTS_PER_WINDOW)) throw fail(429, 'Limite de tentativas atingido. Aguarde 15 minutos antes de tentar novamente.', Math.ceil((Number(old.janela_ate) - time) / 1000));
      if (old && Number(old.reenviar_em) > time) throw fail(429, 'Aguarde um minuto antes de solicitar outro código.', Math.ceil((Number(old.reenviar_em) - time) / 1000));
      const id = randomBytes(32).toString('hex');
      const code = String(randomInt(0, 1000000)).padStart(6, '0');
      const expires = time + 10 * 60 * 1000;
      await connection.query(`INSERT INTO verificacoes_email
        (perfil, usuario_id, desafio, email, codigo_hash, expira_em, reenviar_em, janela_ate, envios, tentativas, consumido)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE desafio = VALUES(desafio), email = VALUES(email), codigo_hash = VALUES(codigo_hash),
        expira_em = VALUES(expira_em), reenviar_em = VALUES(reenviar_em), janela_ate = VALUES(janela_ate),
        envios = VALUES(envios), tentativas = VALUES(tentativas), consumido = 0`,
      [kind, userId, id, user.email, digest(id, code), expires, time + 60000,
        activeWindow ? old.janela_ate : time + 15 * 60 * 1000, activeWindow ? old.envios + 1 : 1, activeWindow ? old.tentativas : 0]);
      try { await send(user.email, code); }
      catch { throw fail(503, 'Não foi possível enviar o código. Tente entrar novamente em alguns instantes.'); }
      return { verificacaoPendente: true, desafio: id, email: user.email, expiraEm: expires, reenviarEm: time + 60000 };
    });
  }

  async function lookup(kind, id) {
    if (!tables[kind] || typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) throw fail(400, 'Verificação inválida. Entre novamente.');
    const [[row]] = await database.query('SELECT usuario_id FROM verificacoes_email WHERE perfil = ? AND desafio = ?', [kind, id]);
    if (!row) throw fail(400, 'Esta verificação não está mais disponível. Entre novamente.');
    return row.usuario_id;
  }

  async function pending(kind, userId, email) {
    if (!tables[kind]) throw fail(400, 'Acesso inválido.');
    const [[row]] = await database.query(
      'SELECT desafio, email, expira_em, reenviar_em FROM verificacoes_email WHERE perfil = ? AND usuario_id = ? AND email = ? AND consumido = 0 LIMIT 1',
      [kind, userId, email],
    );
    return row ? {
      verificacaoPendente: true,
      desafio: row.desafio,
      email: row.email,
      expiraEm: Number(row.expira_em),
      reenviarEm: Number(row.reenviar_em),
    } : null;
  }

  async function verify(kind, id, code) {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw fail(400, 'Informe o código de seis dígitos.');
    const userId = await lookup(kind, id);
    return transaction(async (connection) => {
      const [[user]] = await connection.query(`SELECT * FROM ${tables[kind]} WHERE id = ? FOR UPDATE`, [userId]);
      const [[row]] = await connection.query('SELECT * FROM verificacoes_email WHERE perfil = ? AND usuario_id = ? FOR UPDATE', [kind, userId]);
      if (!user?.ativo || !row || row.desafio !== id || row.consumido || row.email !== user.email) throw fail(400, 'Esta verificação não está mais disponível. Entre novamente.');
      if (Number(row.expira_em) <= now()) throw fail(400, 'Código expirado. Solicite um novo código.');
      if (row.tentativas >= MAX_CODE_ATTEMPTS_PER_WINDOW) throw fail(429, 'Limite de tentativas atingido. Aguarde 15 minutos e entre novamente.');
      if (!timingSafeEqual(Buffer.from(row.codigo_hash, 'hex'), Buffer.from(digest(id, code), 'hex'))) {
        await connection.query('UPDATE verificacoes_email SET tentativas = tentativas + 1 WHERE desafio = ?', [id]);
        return fail(400, 'Código incorreto. Confira o e-mail e tente novamente.');
      }
      await connection.query('UPDATE verificacoes_email SET consumido = 1 WHERE desafio = ?', [id]);
      await connection.query(`UPDATE ${tables[kind]} SET email_verificado_em = CURRENT_TIMESTAMP WHERE id = ?`, [userId]);
      return createAuthenticatedSession(kind, user, 'E-mail confirmado com sucesso!');
    });
  }
  return { issue, pending, verify, async resend(kind, id) { return issue(kind, await lookup(kind, id), id); } };
}

export const emailVerification = createEmailVerification();
export function verificationError(res, error) {
  if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
  if (!error.status) console.error('Erro na verificação de e-mail:', error);
  return res.status(error.status || 500).json({ erro: error.status ? error.message : 'Não foi possível verificar seu e-mail agora.' });
}
