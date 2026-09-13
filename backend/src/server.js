import { createApp } from './app.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'configure-um-segredo-longo-e-aleatorio') {
  throw new Error('Configure JWT_SECRET no ambiente do backend antes de iniciar a API.');
}
const app = createApp();
const PORT = process.env.PORT || 3333;
app.listen(PORT, () => console.log('API rodando na porta ' + PORT));
export default app;
