import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../database.js';
import { limitAuth } from '../middlewares/limitAuth.js';
import { emailVerification, verificationError } from '../services/emailVerification.js';
import { addVerificationRoutes } from './verification.routes.js';

const router = express.Router();
addVerificationRoutes(router, 'profissional', limitAuth);

router.post('/login', limitAuth, async (req, res) => {
  const { email, senha } = req.body || {};
  if (typeof email !== 'string' || typeof senha !== 'string' || !email.trim() || !senha || email.length > 255 || Buffer.byteLength(senha, 'utf8') > 72) {
    return res.status(400).json({ erro: 'Informe o e-mail e a senha.' });
  }
  try {
    const [[usuario]] = await db.query('SELECT id, senha, ativo FROM usuarios_admin WHERE email = ? LIMIT 1', [email.trim().toLowerCase()]);
    if (!usuario?.ativo || !await bcrypt.compare(senha, usuario.senha)) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    return res.json(await emailVerification.issue('profissional', usuario.id));
  } catch (error) {
    return verificationError(res, error);
  }
});

export default router;
