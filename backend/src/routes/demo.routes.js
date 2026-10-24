import express from 'express';
import { loginLimiter } from '../middlewares/limitAuth.js';
import { createDemoSession } from '../services/demoAccess.js';

const router = express.Router();

async function login(kind, res) {
  try {
    return res.json(await createDemoSession(kind));
  } catch (error) {
    return res.status(error.status || 500).json({
      erro: error.status ? error.message : 'Não foi possível iniciar a demonstração.',
    });
  }
}

router.post('/paciente', loginLimiter, (_req, res) => login('paciente', res));
router.post('/profissional', loginLimiter, (_req, res) => login('profissional', res));

export default router;
