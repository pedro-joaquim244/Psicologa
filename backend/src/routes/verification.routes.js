import { emailVerification, verificationError } from '../services/emailVerification.js';
import { authenticateCredentials, validCredentials } from '../services/authentication.js';

export function addVerificationRoutes(router, kind, { verifyLimiter, resendLimiter }) {
  router.post('/verificar-email', verifyLimiter, async (req, res) => {
    try { res.json(await emailVerification.verify(kind, req.body?.desafio, req.body?.codigo)); }
    catch (error) { verificationError(res, error); }
  });
  router.post('/reenviar-codigo', resendLimiter, async (req, res) => {
    try {
      if (req.body?.desafio) return res.json(await emailVerification.resend(kind, req.body.desafio));
      if (!validCredentials(req.body)) return res.status(400).json({ erro: 'Informe o e-mail e a senha para reenviar o código.' });
      const user = await authenticateCredentials(kind, req.body);
      if (!user) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
      if (user.email_verificado_em) return res.status(409).json({ erro: 'Este e-mail já foi confirmado. Entre normalmente com sua senha.' });
      return res.json(await emailVerification.issue(kind, user.id));
    }
    catch (error) { verificationError(res, error); }
  });
}
