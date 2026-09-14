import jwt from "jsonwebtoken";
import db from '../database.js';
import { validId } from '../utils/scheduling.js';

export function autenticarToken(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        erro: "Token não informado.",
      });
    }

    const match = /^Bearer ([^\s]+)$/.exec(authorization);
    if (!match) {
      return res.status(401).json({
        erro: "Token inválido.",
      });
    }
    const token = match[1];

    const usuario = jwt.verify(
      token,
      process.env.JWT_SECRET,
      { algorithms: ['HS256'] }
    );

    if (!validId(usuario.id) || !Number.isFinite(usuario.exp) || typeof usuario.email !== 'string') return res.status(401).json({ erro: 'Sessão inválida. Entre novamente.' });
    if (usuario.email_verificado !== true) return res.status(401).json({ erro: 'Entre novamente para confirmar seu e-mail.' });
    req.usuario = usuario;

    next();

  } catch (error) {
    return res.status(401).json({
      erro: "Token inválido ou expirado.",
    });
  }
}

export async function somentePsicologa(req, res, next) {
  if (
    req.usuario.tipo !== "psicologa" &&
    req.usuario.tipo !== "admin"
  ) {
    return res.status(403).json({
      erro: "Acesso não autorizado.",
    });
  }

  try {
    const [[user]] = await db.query('SELECT id, tipo, email, email_verificado_em FROM usuarios_admin WHERE id = ? AND ativo = 1 LIMIT 1', [req.usuario.id]);
    if (!user || user.tipo !== req.usuario.tipo || user.email !== req.usuario.email || !user.email_verificado_em) {
      return res.status(401).json({ erro: 'Sua sessão não está mais disponível. Entre novamente.' });
    }
    next();
  } catch (error) {
    console.error('Erro ao validar profissional:', error.code || error.name);
    res.status(500).json({ erro: 'Não foi possível verificar sua conta agora.' });
  }
}

export async function somentePaciente(req, res, next) {
  if (req.usuario.tipo !== 'paciente') return res.status(403).json({ erro: 'Entre com uma conta de paciente para agendar.' });
  try {
    const [rows] = await db.query('SELECT id, nome, email, telefone, email_verificado_em FROM pacientes WHERE id = ? AND ativo = 1 LIMIT 1', [req.usuario.id]);
    if (!rows[0]) return res.status(401).json({ erro: 'Sua conta não está disponível. Entre novamente.' });
    if (!rows[0].email_verificado_em || rows[0].email !== req.usuario.email) return res.status(401).json({ erro: 'Entre novamente para confirmar seu e-mail.' });
    req.paciente = rows[0];
    next();
  } catch (error) {
    console.error('Erro ao validar conta:', error.code || error.name);
    res.status(500).json({ erro: 'Não foi possível verificar sua conta agora.' });
  }
}
