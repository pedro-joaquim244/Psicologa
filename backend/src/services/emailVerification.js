import { createHmac, randomInt, randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import db from '../database.js';
import { sendLoginCode } from './email.js';

const tables = { paciente: 'pacientes', profissional: 'usuarios_admin' };
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
      const [[old]] = await connection.query('SELECT * FROM verificacoes_email WHERE perfil = ? AND usuario_id = ? FOR UPDATE', [kind, userId]);
      if (previousId && (!old || old.desafio !== previousId || old.consumido)) throw fail(400, 'Esta verificação não está mais disponível. Entre novamente.');
      const time = now();
      const activeWindow = old && Number(old.janela_ate) > time;
      if (activeWindow && (old.envios >= 5 || old.tentativas >= 5)) throw fail(429, 'Limite de tentativas atingido. Aguarde 15 minutos antes de tentar novamente.', Math.ceil((Number(old.janela_ate) - time) / 1000));
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

  async function verify(kind, id, code) {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw fail(400, 'Informe o código de seis dígitos.');
    const userId = await lookup(kind, id);
    return transaction(async (connection) => {
      const [[user]] = await connection.query(`SELECT * FROM ${tables[kind]} WHERE id = ? FOR UPDATE`, [userId]);
      const [[row]] = await connection.query('SELECT * FROM verificacoes_email WHERE perfil = ? AND usuario_id = ? FOR UPDATE', [kind, userId]);
      if (!user?.ativo || !row || row.desafio !== id || row.consumido || row.email !== user.email) throw fail(400, 'Esta verificação não está mais disponível. Entre novamente.');
      if (Number(row.expira_em) <= now()) throw fail(400, 'Código expirado. Solicite um novo código.');
      if (row.tentativas >= 5) throw fail(429, 'Limite de tentativas atingido. Aguarde 15 minutos e entre novamente.');
      if (!timingSafeEqual(Buffer.from(row.codigo_hash, 'hex'), Buffer.from(digest(id, code), 'hex'))) {
        await connection.query('UPDATE verificacoes_email SET tentativas = tentativas + 1 WHERE desafio = ?', [id]);
        return fail(400, 'Código incorreto. Confira o e-mail e tente novamente.');
      }
      const tipo = kind === 'paciente' ? 'paciente' : user.tipo;
      const token = jwt.sign({ id: user.id, tipo, email: user.email, email_verificado: true }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
      await connection.query('UPDATE verificacoes_email SET consumido = 1 WHERE desafio = ?', [id]);
      await connection.query(`UPDATE ${tables[kind]} SET email_verificado_em = CURRENT_TIMESTAMP WHERE id = ?`, [userId]);
      return { token, usuario: { id: user.id, nome: user.nome, email: user.email, ...(kind === 'paciente' ? { telefone: user.telefone } : {}), tipo, email_verificado: true } };
    });
  }
  return { issue, verify, async resend(kind, id) { return issue(kind, await lookup(kind, id), id); } };
}

export const emailVerification = createEmailVerification();
export function verificationError(res, error) {
  if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
  return res.status(error.status || 500).json({ erro: error.status ? error.message : 'Não foi possível verificar seu e-mail agora.' });
}
