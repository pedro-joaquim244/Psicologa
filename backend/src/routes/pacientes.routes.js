import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../database.js';
import { autenticarToken, somentePaciente } from '../middlewares/autenticacao.js';

import { limitAuth } from '../middlewares/limitAuth.js';
import { emailVerification, verificationError } from '../services/emailVerification.js';
import { addVerificationRoutes } from './verification.routes.js';

const router = express.Router();
addVerificationRoutes(router, 'paciente', limitAuth);

router.post('/cadastro', limitAuth, async (req, res) => {
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
    console.error('Erro ao cadastrar paciente:', error.code || error.name);
    return res.status(500).json({ erro: 'Não foi possível criar sua conta agora.' });
  }
});

router.post('/login', limitAuth, async (req, res) => {
  const { email, senha } = req.body || {};
  if (typeof email !== 'string' || typeof senha !== 'string' || !email.trim() || !senha || email.length > 255 || Buffer.byteLength(senha, 'utf8') > 72) {
    return res.status(400).json({ erro: 'Informe um e-mail e uma senha válidos.' });
  }
  try {
    const [rows] = await db.query('SELECT id, nome, email, telefone, senha, ativo FROM pacientes WHERE email = ? LIMIT 1', [email.trim().toLowerCase()]);
    const usuario = rows[0];
    if (!usuario || !usuario.ativo || !await bcrypt.compare(senha, usuario.senha)) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    return res.json(await emailVerification.issue('paciente', usuario.id));
  } catch (error) {
    if (error.status) return verificationError(res, error);
    console.error('Erro ao entrar como paciente:', error.code || error.name);
    return res.status(500).json({ erro: 'Não foi possível entrar agora.' });
  }
});

router.get('/me', autenticarToken, somentePaciente, (req, res) => {
  res.json({ usuario: { ...req.paciente, tipo: 'paciente' } });
});

export default router;
