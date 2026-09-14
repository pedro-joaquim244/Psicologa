import { Router } from 'express';
import db from '../database.js';
import { autenticarToken, somentePaciente } from '../middlewares/autenticacao.js';

const router = Router();
const patientFields = 'id, modalidade, inicio, fim, status, criado_em';

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
}, autenticarToken, somentePaciente);

router.get('/agendamentos', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ${patientFields} FROM agendamentos WHERE paciente_id = ? ORDER BY inicio ASC, id ASC`,
      [req.usuario.id],
    );
    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar consultas do paciente:', error.code || error.name);
    res.status(500).json({ erro: 'Não foi possível carregar suas consultas.' });
  }
});

router.patch('/agendamentos/:id/cancelar', async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id))) {
    return res.status(400).json({ erro: 'Consulta inválida.' });
  }
  try {
    // Mesma regra da agenda existente: sem antecedência mínima e sem excluir registros.
    // O proprietário participa do UPDATE, inclusive quando o ID da URL é adulterado.
    await db.query(
      "UPDATE agendamentos SET status = 'cancelado' WHERE id = ? AND paciente_id = ? AND status != 'cancelado'",
      [req.params.id, req.usuario.id],
    );
    const [rows] = await db.query(
      `SELECT ${patientFields} FROM agendamentos WHERE id = ? AND paciente_id = ? LIMIT 1`,
      [req.params.id, req.usuario.id],
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Consulta não encontrada.' });
    // Repetir uma solicitação já concluída é seguro após uma falha de rede.
    res.json({ agendamento: rows[0] });
  } catch (error) {
    console.error('Erro ao cancelar consulta do paciente:', error.code || error.name);
    res.status(500).json({ erro: 'Não foi possível cancelar sua consulta. Tente novamente.' });
  }
});

export default router;
