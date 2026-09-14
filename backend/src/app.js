import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import db from './database.js';
import horariosRoutes from './routes/horarios.routes.js';
import agendamentosRoutes from './routes/agendamentos.routes.js';
import authRoutes from './routes/auth.routes.js';
import pacientesRoutes from './routes/pacientes.routes.js';
import usuarioRoutes from './routes/usuario.routes.js';
import agendaRoutes from './routes/agenda.routes.js';

export function createApp({ frontendUrl = process.env.FRONTEND_URL, production = process.env.NODE_ENV === 'production' } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Configure apenas IPs/sub-redes de proxies confiáveis da infraestrutura.
  if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY.split(',').map((value) => value.trim()));
  const origins = new Set((frontendUrl || (production ? '' : 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173')).split(',').filter(Boolean).map((value) => {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('FRONTEND_URL deve conter somente origens HTTP(S), separadas por vírgula.');
    return url.origin;
  }));
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(cors({ origin(origin, callback) { callback(null, !origin || origins.has(origin)); }, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'], exposedHeaders: ['Retry-After'] }));
  app.use(express.json({ limit: '32kb' }));
  app.get('/', (_req, res) => res.json({ mensagem: 'API da agenda funcionando!' }));
  app.get('/api/teste-banco', async (_req, res) => {
    try {
      const [resultado] = await db.query('SELECT NOW() AS agora');
      res.json({ mensagem: 'Banco conectado com sucesso!', resultado });
    } catch (error) {
      console.error('Erro ao conectar no banco:', error.code || error.name);
      res.status(503).json({ erro: 'Não foi possível conectar no banco.' });
    }
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/pacientes', pacientesRoutes);
  app.use('/api/usuario', usuarioRoutes);
  app.use('/api/horarios', horariosRoutes);
  app.use('/api/agendamentos', agendamentosRoutes);
  app.use('/api/agenda', agendaRoutes);
  app.use((_req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ erro: 'O corpo da solicitação deve ser um JSON válido.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ erro: 'A solicitação excede o tamanho permitido.' });
    console.error('Erro na API:', error.code || error.name);
    res.status(500).json({ erro: 'Não foi possível concluir a solicitação agora.' });
  });
  return app;
}
