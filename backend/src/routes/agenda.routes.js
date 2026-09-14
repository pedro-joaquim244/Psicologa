import express from 'express';
import db from '../database.js';
import { autenticarToken, somentePsicologa } from '../middlewares/autenticacao.js';
import { validDate, validId } from '../utils/scheduling.js';
import {
  AgendaError, professionalId, weekday, validateWindow, serializeAvailability, serializeBlock,
  loadDaySchedule, assertNoActiveAppointment, assertNoBlock,
  assertExistingBookingsRemainCovered, assertAvailabilityCompatible,
} from '../services/agenda.js';

const router = express.Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.use(autenticarToken, somentePsicologa);
router.param('id', (_req, res, next, id) => validId(id) ? next() : res.status(400).json({ erro: 'Horário inválido.' }));

function respondError(res, error) {
  if (error instanceof AgendaError) return res.status(error.status).json({ erro: error.message });
  if (['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) {
    return res.status(409).json({ erro: 'A agenda mudou durante esta ação. Atualize os horários e tente novamente.' });
  }
  console.error('Erro ao administrar horários:', error.code || error.name);
  return res.status(500).json({ erro: 'Não foi possível atualizar os horários agora.' });
}

async function mutate(req, res, action) {
  let connection;
  try {
    const id = professionalId(req.body?.profissional_id ?? req.query.profissional_id);
    connection = await db.getConnection();
    await connection.beginTransaction();
    // O mesmo registro é bloqueado pelo POST /agendamentos. Nenhuma reserva pode
    // entrar entre a verificação de conflitos e a gravação de uma alteração.
    const [[professional]] = await connection.query('SELECT id FROM profissionais WHERE id = ? AND ativo = 1 FOR UPDATE', [id]);
    if (!professional) throw new AgendaError('Profissional indisponível.', 404);
    const result = await action(connection, id);
    await connection.commit();
    return res.status(result.status || 200).json(result.body);
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch { /* Conexão encerrada. */ } }
    return respondError(res, error);
  } finally { connection?.release(); }
}

async function availabilityById(connection, id, professional) {
  const [[row]] = await connection.query('SELECT * FROM disponibilidades WHERE id = ? AND profissional_id = ? AND ativo = 1 LIMIT 1', [id, professional]);
  if (!row) throw new AgendaError('Horário disponível não encontrado.', 404);
  return row;
}

async function blockById(connection, id, professional) {
  const [[row]] = await connection.query('SELECT id, profissional_id, inicio, fim, motivo FROM bloqueios_agenda WHERE id = ? AND profissional_id = ? LIMIT 1', [id, professional]);
  if (!row) throw new AgendaError('Horário ocupado não encontrado.', 404);
  return row;
}

router.get('/', async (req, res) => {
  try {
    const { data } = req.query;
    if (!validDate(data)) throw new AgendaError('Informe uma data válida.');
    const id = professionalId(req.query.profissional_id);
    const [[professional]] = await db.query('SELECT id FROM profissionais WHERE id = ? AND ativo = 1 LIMIT 1', [id]);
    if (!professional) throw new AgendaError('Profissional indisponível.', 404);
    const [recurring] = await db.query(`SELECT id, profissional_id, dia_semana, data_especifica, hora_inicio, hora_fim, duracao_minutos, intervalo_minutos
      FROM disponibilidades WHERE profissional_id = ? AND data_especifica IS NULL AND ativo = 1 ORDER BY dia_semana, hora_inicio, id`, [id]);
    const { availability, blocks, horarios } = await loadDaySchedule(db, data, id, { privateDetails: true });
    const defaults = recurring.find((row) => row.dia_semana === weekday(data)) || recurring[0];
    return res.json({ data, profissional_id: id,
      duracao_padrao: defaults?.duracao_minutos || 50, intervalo_padrao: defaults?.intervalo_minutos ?? 10,
      recorrentes: recurring.map(serializeAvailability), extras: availability.filter((row) => row.data_especifica).map(serializeAvailability),
      bloqueios: blocks.map(serializeBlock), horarios,
    });
  } catch (error) { return respondError(res, error); }
});

router.post('/disponibilidades', (req, res) => mutate(req, res, async (connection, id) => {
  const window = validateWindow({ ...req.body, profissional_id: id });
  await assertAvailabilityCompatible(connection, window);
  const [result] = await connection.query(`INSERT INTO disponibilidades
    (profissional_id, dia_semana, data_especifica, hora_inicio, hora_fim, duracao_minutos, intervalo_minutos, ativo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)`, [id, window.dia_semana, window.data_especifica, window.hora_inicio, window.hora_fim, window.duracao_minutos, window.intervalo_minutos]);
  const saved = await availabilityById(connection, result.insertId, id);
  return { status: 201, body: { mensagem: 'Horário disponível criado.', disponibilidade: serializeAvailability(saved) } };
}));

router.patch('/disponibilidades/:id', (req, res) => mutate(req, res, async (connection, id) => {
  const previous = await availabilityById(connection, req.params.id, id);
  const window = validateWindow({ ...req.body, profissional_id: id });
  await assertExistingBookingsRemainCovered(connection, previous, window);
  await assertAvailabilityCompatible(connection, window, previous.id);
  await connection.query(`UPDATE disponibilidades SET dia_semana = ?, data_especifica = ?, hora_inicio = ?, hora_fim = ?, duracao_minutos = ?, intervalo_minutos = ?
    WHERE id = ? AND profissional_id = ?`, [window.dia_semana, window.data_especifica, window.hora_inicio, window.hora_fim, window.duracao_minutos, window.intervalo_minutos, previous.id, id]);
  return { body: { mensagem: 'Horário disponível atualizado.', disponibilidade: serializeAvailability(await availabilityById(connection, previous.id, id)) } };
}));

router.delete('/disponibilidades/:id', (req, res) => mutate(req, res, async (connection, id) => {
  const previous = await availabilityById(connection, req.params.id, id);
  await assertExistingBookingsRemainCovered(connection, previous, null);
  await connection.query('DELETE FROM disponibilidades WHERE id = ? AND profissional_id = ?', [previous.id, id]);
  return { body: { mensagem: 'Horário disponível removido.' } };
}));

router.post('/bloqueios', (req, res) => mutate(req, res, async (connection, id) => {
  const window = validateWindow({ ...req.body, profissional_id: id }, { block: true });
  await assertNoActiveAppointment(connection, id, window.inicio, window.fim);
  await assertNoBlock(connection, id, window.inicio, window.fim);
  const [result] = await connection.query('INSERT INTO bloqueios_agenda (profissional_id, inicio, fim, motivo) VALUES (?, ?, ?, ?)', [id, window.inicio, window.fim, window.motivo]);
  return { status: 201, body: { mensagem: 'Horário ocupado criado.', bloqueio: serializeBlock(await blockById(connection, result.insertId, id)) } };
}));

router.patch('/bloqueios/:id', (req, res) => mutate(req, res, async (connection, id) => {
  const previous = await blockById(connection, req.params.id, id);
  const window = validateWindow({ ...req.body, profissional_id: id }, { block: true });
  await assertNoActiveAppointment(connection, id, window.inicio, window.fim);
  await assertNoBlock(connection, id, window.inicio, window.fim, previous.id);
  await connection.query('UPDATE bloqueios_agenda SET inicio = ?, fim = ?, motivo = ? WHERE id = ? AND profissional_id = ?', [window.inicio, window.fim, window.motivo, previous.id, id]);
  return { body: { mensagem: 'Horário ocupado atualizado.', bloqueio: serializeBlock(await blockById(connection, previous.id, id)) } };
}));

router.delete('/bloqueios/:id', (req, res) => mutate(req, res, async (connection, id) => {
  const previous = await blockById(connection, req.params.id, id);
  await connection.query('DELETE FROM bloqueios_agenda WHERE id = ? AND profissional_id = ?', [previous.id, id]);
  return { body: { mensagem: 'Horário ocupado removido.' } };
}));

export default router;
