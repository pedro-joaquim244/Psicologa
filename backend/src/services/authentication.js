import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../database.js';

const profiles = {
  paciente: { table: 'pacientes', type: () => 'paciente', extra: ', telefone' },
  profissional: { table: 'usuarios_admin', type: (user) => user.tipo, extra: ', tipo, profissional_id' },
};

export const EMAIL_NOT_VERIFIED = 'EMAIL_NAO_VERIFICADO';

export function validCredentials(body) {
  const { email, senha } = body || {};
  return typeof email === 'string'
    && typeof senha === 'string'
    && Boolean(email.trim())
    && Boolean(senha)
    && email.length <= 255
    && Buffer.byteLength(senha, 'utf8') <= 72;
}

export async function authenticateCredentials(kind, body, database = db) {
  const profile = profiles[kind];
  if (!profile || !validCredentials(body)) return null;
  const [rows] = await database.query(
    `SELECT id, nome, email, senha, ativo, email_verificado_em${profile.extra} FROM ${profile.table} WHERE email = ? LIMIT 1`,
    [body.email.trim().toLowerCase()],
  );
  const user = rows[0];
  if (!user?.ativo || !await bcrypt.compare(body.senha, user.senha)) return null;
  return user;
}

export function createAuthenticatedSession(kind, user, mensagem = 'Login realizado com sucesso!') {
  const profile = profiles[kind];
  if (!profile) throw new Error('Perfil de autenticação inválido.');
  const tipo = profile.type(user);
  const token = jwt.sign(
    { id: user.id, tipo, email: user.email, email_verificado: true, ...(user.profissional_id ? { profissional_id: user.profissional_id } : {}) },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  );
  return {
    mensagem,
    token,
    usuario: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      ...(kind === 'paciente' ? { telefone: user.telefone } : {}),
      ...(user.profissional_id ? { profissional_id: user.profissional_id } : {}),
      tipo,
      email_verificado: true,
    },
  };
}
