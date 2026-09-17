import express from 'express';
import db from '../database.js';
import { autenticarToken, somentePsicologa } from '../middlewares/autenticacao.js';
import { writeLimiter } from '../middlewares/limitAuth.js';
import { validDate, validId } from '../utils/scheduling.js';
import {
  AgendaError, professionalId, weekday, validateWindow, serializeAvailability, serializeBlock,
  loadDaySchedule, assertBlockCompatible,
  assertExistingBookingsRemainCovered, assertAvailabilityCompatible, loadUpcomingExceptions,
} from '../services/agenda.js';
import { createAvailabilityBatch, copyDay, applySlotAction, createBlockBatch, blockOccurrence, insertBlock } from '../services/agendaBulk.js';

const router = express.Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.use(autenticarToken, somentePsicologa);
router.use((req, res, next) => {
  if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) return next();
  return writeLimiter(req, res, next);
});
router.param('id', (_req, res, next, id) => validId(id) ? next() : res.status(400).json({ erro: 'Horário inválido.' }));

function respondError(res, error) {
  if (error instanceof AgendaError) return res.status(error.status).json({ erro: error.message });
  if (['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) {
    return res.status(409).json({ erro: 'A agenda mudou durante esta ação. Atualize os horários e tente novamente.' });
  }
  console.error('Erro ao administrar horários:', error);
  return res.status(500).json({ erro: 'Não foi possível atualizar os horários agora.' });
}

function batchMessage(result, noun, verb) {
  const created = Number(result.criados || 0);
  const ignored = Number(result.ignorados || 0);
  const primary = `${created} ${noun}${created === 1 ? '' : 's'} ${verb}${created === 1 ? '' : 's'}.`;
  return ignored ? `${primary} ${ignored} duplicado${ignored === 1 ? '' : 's'} ignorado${ignored === 1 ? '' : 's'}.` : primary;
}

async function mutate(req, res, action) {
  let connection;
  try {
    const requestedId = req.body?.profissional_id ?? req.query.profissional_id;
    if (requestedId != null) professionalId(requestedId);
    // Use the server-validated account binding, not an optional JWT claim. This
    // also restricts sessions issued before profissional_id existed.
    const hasFixedProfile = req.usuario.tipo === 'psicologa';
    if (hasFixedProfile && requestedId != null && Number(requestedId) !== req.profissional_id) {
      throw new AgendaError('Acesso não autorizado para este profissional.', 403);
    }
    const id = professionalId(hasFixedProfile ? req.profissional_id : (requestedId ?? req.profissional_id ?? 1));
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
  const [[row]] = await connection.query('SELECT id, profissional_id, inicio, fim, dia_semana, hora_inicio, hora_fim, motivo FROM bloqueios_agenda WHERE id = ? AND profissional_id = ? LIMIT 1', [id, professional]);
  if (!row) throw new AgendaError('Horário ocupado não encontrado.', 404);
  return row;
}

router.get('/', async (req, res) => {
  try {
    const { data } = req.query;
    if (!validDate(data)) throw new AgendaError('Informe uma data válida.');
    const requestedId = req.query.profissional_id;
    if (requestedId != null) professionalId(requestedId);
    // See mutate: legacy JWTs must remain restricted to the current account.
    const hasFixedProfile = req.usuario.tipo === 'psicologa';
    if (hasFixedProfile && requestedId != null && Number(requestedId) !== req.profissional_id) {
      throw new AgendaError('Acesso não autorizado para este profissional.', 403);
    }
    const id = professionalId(hasFixedProfile ? req.profissional_id : (requestedId ?? req.profissional_id ?? 1));
    const [[professional]] = await db.query('SELECT id FROM profissionais WHERE id = ? AND ativo = 1 LIMIT 1', [id]);
    if (!professional) throw new AgendaError('Profissional indisponível.', 404);
    const [recurring] = await db.query(`SELECT id, profissional_id, dia_semana, data_especifica, hora_inicio, hora_fim, duracao_minutos, intervalo_minutos
      FROM disponibilidades WHERE profissional_id = ? AND data_especifica IS NULL AND ativo = 1 ORDER BY dia_semana, hora_inicio, id`, [id]);
    const { availability, blocks, horarios } = await loadDaySchedule(db, data, id, { privateDetails: true });
    const proximasExcecoes = await loadUpcomingExceptions(db, id);
    const [recurringBlocks] = await db.query(`SELECT id, profissional_id, inicio, fim, dia_semana, hora_inicio, hora_fim, motivo
      FROM bloqueios_agenda WHERE profissional_id = ? AND inicio IS NULL ORDER BY dia_semana, hora_inicio, id`, [id]);
    const defaults = recurring.find((row) => row.dia_semana === weekday(data)) || recurring[0];
    return res.json({ data, profissional_id: id,
      duracao_padrao: defaults?.duracao_minutos || 50, intervalo_padrao: defaults?.intervalo_minutos ?? 10,
      recorrentes: recurring.map(serializeAvailability), extras: availability.filter((row) => row.data_especifica).map(serializeAvailability),
      bloqueios: blocks.map(serializeBlock), bloqueios_recorrentes: recurringBlocks.map(serializeBlock), horarios,
      proximas_excecoes: proximasExcecoes,
    });
  } catch (error) { return respondError(res, error); }
});

router.post('/disponibilidades/lote', (req, res) => mutate(req, res, async (connection, id) => {
  const result = await createAvailabilityBatch(connection, id, req.body || {});
  return { status: 201, body: { ...result, mensagem: batchMessage(result, 'horário', 'adicionado') } };
}));

router.post('/disponibilidades/copiar', (req, res) => mutate(req, res, async (connection, id) => {
  const result = await copyDay(connection, id, req.body || {});
  return { status: 201, body: { ...result, mensagem: batchMessage(result, 'horário', 'copiado') } };
}));

router.post('/disponibilidades/acoes', (req, res) => mutate(req, res, async (connection, id) => {
  const result = await applySlotAction(connection, id, req.body || {});
  const verb = req.body?.acao === 'remover' ? 'removido' : req.body?.acao === 'bloquear' ? 'bloqueado' : 'atualizado';
  return { body: { ...result, mensagem: batchMessage(result, 'horário', verb) } };
}));

router.post('/bloqueios/lote', (req, res) => mutate(req, res, async (connection, id) => {
  const result = await createBlockBatch(connection, id, req.body || {});
  return { status: 201, body: { ...result, mensagem: batchMessage(result, 'bloqueio', 'adicionado') } };
}));

router.post('/disponibilidades/:id/ocorrencia', (req, res) => mutate(req, res, async (connection, id) => {
  const previous = await availabilityById(connection, req.params.id, id);
  const blockId = await blockOccurrence(connection, id, previous, req.body || {});
  return { status: 201, body: { mensagem: 'Horário removido somente desta data.', bloqueio: serializeBlock(await blockById(connection, blockId, id)) } };
}));

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
  await assertExistingBookingsRemainCovered(connection, previous);
  await connection.query('DELETE FROM disponibilidades WHERE id = ? AND profissional_id = ?', [previous.id, id]);
  return { body: { mensagem: 'Horário disponível removido. Consultas já marcadas foram preservadas.' } };
}));

router.post('/bloqueios', (req, res) => mutate(req, res, async (connection, id) => {
  const window = validateWindow({ ...req.body, profissional_id: id }, { block: true });
  await assertBlockCompatible(connection, window);
  const blockId = await insertBlock(connection, window);
  return { status: 201, body: { mensagem: 'Horário ocupado criado.', bloqueio: serializeBlock(await blockById(connection, blockId, id)) } };
}));

router.patch('/bloqueios/:id', (req, res) => mutate(req, res, async (connection, id) => {
  const previous = await blockById(connection, req.params.id, id);
  const window = validateWindow({ ...req.body, profissional_id: id }, { block: true });
  await assertBlockCompatible(connection, window, previous.id);
  await connection.query(`UPDATE bloqueios_agenda SET inicio = ?, fim = ?, dia_semana = ?, hora_inicio = ?, hora_fim = ?, motivo = ? WHERE id = ? AND profissional_id = ?`,
    [window.inicio, window.fim, window.dia_semana, window.dia_semana == null ? null : window.hora_inicio, window.dia_semana == null ? null : window.hora_fim, window.motivo, previous.id, id]);
  return { body: { mensagem: 'Horário ocupado atualizado.', bloqueio: serializeBlock(await blockById(connection, previous.id, id)) } };
}));

router.delete('/bloqueios/:id', (req, res) => mutate(req, res, async (connection, id) => {
  const previous = await blockById(connection, req.params.id, id);
  await connection.query('DELETE FROM bloqueios_agenda WHERE id = ? AND profissional_id = ?', [previous.id, id]);
  return { body: { mensagem: 'Horário ocupado removido.' } };
}));

export default router;
