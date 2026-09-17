import { generateSlots, validId, validTime } from '../utils/scheduling.js';
import {
  AgendaError, assertAvailabilityCompatible, assertBlockCompatible,
  assertExistingBookingsRemainCovered, validateWindow, validateBlock,
} from './agenda.js';

const MAX_SLOTS = 500;
const time = (value) => String(value).slice(0, 5);
const minutes = (value) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; };
const clock = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

export function validateDays(days) {
  if (!Array.isArray(days) || !days.length || days.length > 7 || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) throw new AgendaError('Selecione de um a sete dias da semana válidos.');
  return [...new Set(days)];
}

export async function insertAvailability(connection, window) {
  const [result] = await connection.query(`INSERT INTO disponibilidades
    (profissional_id, dia_semana, data_especifica, hora_inicio, hora_fim, duracao_minutos, intervalo_minutos, ativo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)`, [window.profissional_id, window.dia_semana, window.data_especifica,
    window.hora_inicio, window.hora_fim, window.duracao_minutos, window.intervalo_minutos]);
  return result.insertId;
}

export async function insertBlock(connection, window) {
  const [result] = await connection.query(`INSERT INTO bloqueios_agenda
    (profissional_id, inicio, fim, dia_semana, hora_inicio, hora_fim, motivo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [window.profissional_id, window.inicio, window.fim, window.dia_semana, window.dia_semana == null ? null : window.hora_inicio, window.dia_semana == null ? null : window.hora_fim, window.motivo]);
  return result.insertId;
}

export function slotWindow(row, slot) {
  return { ...row, hora_inicio: slot.horario, hora_fim: slot.fim, duracao_minutos: minutes(slot.fim) - minutes(slot.horario),
    inicio: row.data_especifica ? `${row.data_especifica} ${slot.horario}:00` : null,
    fim: row.data_especifica ? `${row.data_especifica} ${slot.fim}:00` : null };
}

async function exactAvailabilityExists(connection, window) {
  const [rows] = await connection.query(`SELECT hora_inicio, hora_fim, duracao_minutos, intervalo_minutos FROM disponibilidades
    WHERE profissional_id = ? AND ativo = 1 AND
    ((? IS NULL AND data_especifica IS NULL AND dia_semana = ?) OR
     (? IS NOT NULL AND (data_especifica = ? OR (data_especifica IS NULL AND dia_semana = ?))))`,
  [window.profissional_id, window.data_especifica, window.dia_semana, window.data_especifica, window.data_especifica, window.dia_semana]);
  return generateSlots(rows).some((slot) => slot.horario === window.hora_inicio && slot.fim === window.hora_fim);
}

async function saveWindows(connection, windows) {
  if (!windows.length || windows.length > MAX_SLOTS) throw new AgendaError(`Crie de um a ${MAX_SLOTS} horários por operação.`);
  let criados = 0, ignorados = 0;
  for (const window of windows) {
    if (await exactAvailabilityExists(connection, window)) { ignorados++; continue; }
    await assertAvailabilityCompatible(connection, window);
    await insertAvailability(connection, window);
    criados++;
  }
  return { criados, ignorados };
}

export async function createAvailabilityBatch(connection, id, body) {
  if (!['recorrente', 'extra'].includes(body.tipo)) throw new AgendaError('Escolha horário recorrente ou extra.');
  const days = body.tipo === 'recorrente' ? validateDays(body.dias_semana) : [0];
  if (!Array.isArray(body.periodos) || !body.periodos.length || body.periodos.length > 32) throw new AgendaError('Informe de um a 32 períodos.');
  const windows = [];
  for (const day of days) {
    for (const period of body.periodos) {
      if (!period || typeof period !== 'object' || Array.isArray(period)) throw new AgendaError('Informe um período válido.');
      const recurring = validateWindow({ ...period, profissional_id: id, tipo: 'recorrente', dia_semana: day });
      for (const slot of generateSlots([recurring])) {
        const window = body.tipo === 'extra'
          ? { ...validateWindow({ profissional_id: id, tipo: 'extra', data: body.data, hora_inicio: slot.horario, hora_fim: slot.fim }), intervalo_minutos: recurring.intervalo_minutos }
          : slotWindow(recurring, slot);
        windows.push(window);
        if (windows.length > MAX_SLOTS) throw new AgendaError(`Crie no máximo ${MAX_SLOTS} horários por operação.`);
      }
    }
  }
  return saveWindows(connection, windows);
}

export async function copyDay(connection, id, body) {
  validateDays([body.origem_dia]);
  const destinations = validateDays(body.dias_destino);
  const [rows] = await connection.query(`SELECT * FROM disponibilidades WHERE profissional_id = ? AND ativo = 1
    AND data_especifica IS NULL AND dia_semana = ? ORDER BY hora_inicio, id`, [id, body.origem_dia]);
  if (!rows.length) throw new AgendaError('O dia de origem não possui horários para copiar.');
  const windows = destinations.flatMap((day) => rows.flatMap((row) => generateSlots([row]).map((slot) => slotWindow({ ...row, dia_semana: day }, slot))));
  return saveWindows(connection, windows);
}

async function exactBlockExists(connection, window) {
  const [rows] = await connection.query(`SELECT id FROM bloqueios_agenda WHERE profissional_id = ? AND
    ((dia_semana IS NULL AND inicio = ? AND fim = ?) OR (inicio IS NULL AND dia_semana = ? AND hora_inicio = ? AND hora_fim = ?)) LIMIT 1`,
  [window.profissional_id, window.inicio, window.fim, window.dia_semana, window.hora_inicio, window.hora_fim]);
  return rows.length > 0;
}

async function saveBlocks(connection, windows) {
  let criados = 0, ignorados = 0;
  for (const window of windows) {
    if (await exactBlockExists(connection, window)) { ignorados++; continue; }
    await assertBlockCompatible(connection, window);
    await insertBlock(connection, window);
    criados++;
  }
  return { criados, ignorados };
}

export async function createBlockBatch(connection, id, body) {
  const days = body.tipo === 'recorrente' ? validateDays(body.dias_semana) : [null];
  const windows = days.map((day) => validateBlock({ ...body, profissional_id: id, dia_semana: day }));
  return saveBlocks(connection, windows);
}

async function selectedSlots(connection, id, selected) {
  if (!Array.isArray(selected) || !selected.length || selected.length > 250) throw new AgendaError('Selecione de um a 250 horários por operação.');
  const cache = new Map(), seen = new Set(), result = [];
  for (const item of selected) {
    if (!item || typeof item !== 'object' || !validId(item.id) || !validTime(item.horario)) throw new AgendaError('Seleção de horário inválida.');
    const key = `${Number(item.id)}:${item.horario}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let row = cache.get(Number(item.id));
    if (!row) {
      const [[found]] = await connection.query('SELECT * FROM disponibilidades WHERE id = ? AND profissional_id = ? AND ativo = 1', [item.id, id]);
      if (!found) throw new AgendaError('Um dos horários não existe mais. Atualize a agenda.', 409);
      row = found;
      cache.set(Number(item.id), row);
    }
    const slot = generateSlots([row]).find((value) => value.horario === item.horario);
    if (!slot) throw new AgendaError('Um dos horários mudou. Atualize a agenda.', 409);
    result.push({ row, slot });
  }
  return result;
}

export async function applySlotAction(connection, id, body) {
  if (!['remover', 'duracao', 'duplicar', 'bloquear'].includes(body.acao)) throw new AgendaError('Escolha uma ação válida para os horários.');
  const selected = await selectedSlots(connection, id, body.selecionados);
  if (body.acao === 'duplicar') {
    const days = validateDays(body.dias_destino);
    if (selected.some(({ row }) => row.data_especifica)) throw new AgendaError('Selecione horários recorrentes para copiar entre dias da semana.');
    return saveWindows(connection, days.flatMap((day) => selected.map(({ row, slot }) => slotWindow({ ...row, dia_semana: day }, slot))));
  }
  if (body.acao === 'bloquear') {
    return saveBlocks(connection, selected.map(({ row, slot }) => validateBlock({ profissional_id: id,
      tipo: row.data_especifica ? 'data' : 'recorrente', data: row.data_especifica, dia_semana: row.dia_semana,
      hora_inicio: slot.horario, hora_fim: slot.fim, motivo: body.motivo })));
  }
  if (body.acao === 'duracao' && (!Number.isInteger(body.duracao_minutos) || body.duracao_minutos < 1 || body.duracao_minutos > 1439)) throw new AgendaError('Informe uma duração entre 1 e 1439 minutos.');
  const grouped = new Map();
  for (const entry of selected) {
    if (!grouped.has(entry.row.id)) grouped.set(entry.row.id, { row: entry.row, selected: new Set() });
    grouped.get(entry.row.id).selected.add(entry.slot.horario);
  }
  const replacements = [];
  for (const { row, selected: starts } of grouped.values()) {
    for (const slot of generateSlots([row])) {
      const chosen = starts.has(slot.horario);
      if (chosen && body.acao === 'remover') {
        await assertExistingBookingsRemainCovered(connection, slotWindow(row, slot));
        continue;
      }
      let window = slotWindow(row, slot);
      if (chosen && body.acao === 'duracao') {
        const end = minutes(slot.horario) + body.duracao_minutos;
        if (end > 1439) throw new AgendaError('A duração precisa terminar no mesmo dia.');
        window = slotWindow(row, { horario: slot.horario, fim: clock(end) });
        await assertExistingBookingsRemainCovered(connection, slotWindow(row, slot), window);
      }
      replacements.push({ window, changed: chosen });
      if (replacements.length > MAX_SLOTS) throw new AgendaError(`Este período contém mais de ${MAX_SLOTS} horários. Divida a alteração.`);
    }
  }
  // Reconstrói apenas os períodos selecionados, preservando os outros slots e
  // todas as consultas. O lock do profissional e a transação cobrem a operação.
  for (const { row } of grouped.values()) await connection.query('DELETE FROM disponibilidades WHERE id = ? AND profissional_id = ?', [row.id, id]);
  for (const entry of replacements) entry.id = await insertAvailability(connection, entry.window);
  if (body.acao === 'duracao') {
    for (const entry of replacements.filter((item) => item.changed)) await assertAvailabilityCompatible(connection, entry.window, entry.id);
  }
  return body.acao === 'remover' ? { removidos: selected.length } : { alterados: selected.length };
}

export async function blockOccurrence(connection, id, row, body) {
  if (row.data_especifica) throw new AgendaError('Use a remoção do horário extra para esta data.');
  const window = validateWindow({ tipo: 'extra', profissional_id: id, data: body.data, hora_inicio: body.horario, hora_fim: '23:59' });
  if (window.dia_semana !== row.dia_semana) throw new AgendaError('A data não pertence ao dia da semana deste horário.');
  const slot = generateSlots([row]).find((item) => item.horario === body.horario);
  if (!slot) throw new AgendaError('O horário não pertence a este período de atendimento.');
  const block = validateBlock({ profissional_id: id, data: body.data, hora_inicio: slot.horario, hora_fim: slot.fim, motivo: 'Ocorrência removida da disponibilidade' });
  await assertBlockCompatible(connection, block);
  return insertBlock(connection, block);
}
