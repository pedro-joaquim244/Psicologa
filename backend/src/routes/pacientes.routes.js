import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../database.js';
import { autenticarToken, somentePaciente } from '../middlewares/autenticacao.js';

import { loginLimiter, registerLimiter, resendLimiter, verificationLimiter } from '../middlewares/limitAuth.js';
import { emailVerification, verificationError } from '../services/emailVerification.js';
import { authenticateCredentials, createAuthenticatedSession, EMAIL_NOT_VERIFIED, validCredentials } from '../services/authentication.js';
import { addVerificationRoutes } from './verification.routes.js';

const router = express.Router();
addVerificationRoutes(router, 'paciente', { verifyLimiter: verificationLimiter, resendLimiter });

router.post('/cadastro', registerLimiter, async (req, res) => {
  const { nome, email, telefone, senha } = req.body || {};
  if (typeof nome !== 'string' || nome.trim().length < 3 || nome.trim().length > 150
      || typeof email !== 'string' || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      || typeof telefone !== 'string' || !/^\d{10,13}$/.test(telefone.replace(/\D/g, ''))
      || typeof senha !== 'string' || senha.length < 8 || Buffer.byteLength(senha, 'utf8') > 72) {
    return res.status(400).json({ erro: 'Confira nome, e-mail, WhatsApp com DDD e senha. A senha deve ter pelo menos 8 caracteres e não pode ser excessivamente longa.' });
  }
  try {
    const usuario = { nome: nome.trim(), email: email.trim().toLowerCase(), telefone: telefone.replace(/\D/g, '') };
    const hash = await bcrypt.hash(senha, 12);
    const [result] = await db.query('INSERT INTO pacientes (nome, email, telefone, senha) VALUES (?, ?, ?, ?)', [usuario.nome, usuario.email, usuario.telefone, hash]);
    usuario.id = result.insertId;
    try {
      return res.status(201).json({ mensagem: 'Conta criada. Confirme seu e-mail para entrar.', ...await emailVerification.issue('paciente', usuario.id) });
    } catch (error) {
      return res.status(error.status || 503).json({ contaCriada: true, erro: 'Sua conta foi criada, mas não foi possível enviar o código. Vá para Entrar e tente novamente em alguns instantes.' });
    }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Já existe uma conta com esse e-mail. Entre com sua senha.' });
    console.error('Erro ao cadastrar paciente:', error);
    return res.status(500).json({ erro: 'Não foi possível criar sua conta agora.' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, senha } = req.body || {};
  if (!validCredentials({ email, senha })) {
    return res.status(400).json({ erro: 'Informe um e-mail e uma senha válidos.' });
  }
  try {
    const usuario = await authenticateCredentials('paciente', { email, senha });
    if (!usuario) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    if (!usuario.email_verificado_em) {
      const pending = await emailVerification.pending('paciente', usuario.id, usuario.email);
      return res.status(403).json({ erro: 'Confirme seu e-mail antes de entrar.', codigo: EMAIL_NOT_VERIFIED, ...pending });
    }
    return res.json(createAuthenticatedSession('paciente', usuario));
  } catch (error) {
    if (error.status) return verificationError(res, error);
    console.error('Erro ao entrar como paciente:', error);
    return res.status(500).json({ erro: 'Não foi possível entrar agora.' });
  }
});

router.get('/me', autenticarToken, somentePaciente, (req, res) => {
  res.json({ usuario: { ...req.paciente, tipo: 'paciente' } });
});

export default router;
