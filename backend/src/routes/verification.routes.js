import { emailVerification, verificationError } from '../services/emailVerification.js';

export function addVerificationRoutes(router, kind, limiter) {
  router.post('/verificar-email', limiter, async (req, res) => {
    try { res.json(await emailVerification.verify(kind, req.body?.desafio, req.body?.codigo)); }
    catch (error) { verificationError(res, error); }
  });
  router.post('/reenviar-codigo', limiter, async (req, res) => {
    try { res.json(await emailVerification.resend(kind, req.body?.desafio)); }
    catch (error) { verificationError(res, error); }
  });
}
