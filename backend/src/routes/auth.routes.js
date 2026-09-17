import express from 'express';
import { loginLimiter, resendLimiter, verificationLimiter } from '../middlewares/limitAuth.js';
import { emailVerification, verificationError } from '../services/emailVerification.js';
import { authenticateCredentials, createAuthenticatedSession, EMAIL_NOT_VERIFIED, validCredentials } from '../services/authentication.js';
import { addVerificationRoutes } from './verification.routes.js';

const router = express.Router();
addVerificationRoutes(router, 'profissional', { verifyLimiter: verificationLimiter, resendLimiter });

router.post('/login', loginLimiter, async (req, res) => {
  const { email, senha } = req.body || {};
  if (!validCredentials({ email, senha })) {
    return res.status(400).json({ erro: 'Informe o e-mail e a senha.' });
  }
  try {
    const usuario = await authenticateCredentials('profissional', { email, senha });
    if (!usuario) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    if (!usuario.email_verificado_em) {
      const pending = await emailVerification.pending('profissional', usuario.id, usuario.email);
      return res.status(403).json({ erro: 'Confirme seu e-mail antes de entrar.', codigo: EMAIL_NOT_VERIFIED, ...pending });
    }
    return res.json(createAuthenticatedSession('profissional', usuario));
  } catch (error) {
    return verificationError(res, error);
  }
});

export default router;
