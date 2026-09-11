import jwt from "jsonwebtoken";
import db from '../database.js';

export function autenticarToken(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        erro: "Token não informado.",
      });
    }

    const [tipo, token] = authorization.split(" ");

    if (tipo !== "Bearer" || !token) {
      return res.status(401).json({
        erro: "Token inválido.",
      });
    }

    const usuario = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (usuario.email_verificado !== true) return res.status(401).json({ erro: 'Entre novamente para confirmar seu e-mail.' });
    req.usuario = usuario;

    next();

  } catch (error) {
    return res.status(401).json({
      erro: "Token inválido ou expirado.",
    });
  }
}

export function somentePsicologa(req, res, next) {
  if (
    req.usuario.tipo !== "psicologa" &&
    req.usuario.tipo !== "admin"
  ) {
    return res.status(403).json({
      erro: "Acesso não autorizado.",
    });
  }

  next();
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
