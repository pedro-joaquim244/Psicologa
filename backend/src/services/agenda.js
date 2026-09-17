import { clinicNow, generateSlots, validDate, validId, validTime } from '../utils/scheduling.js';

export class AgendaError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export const weekday = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
export const overlaps = (start, end, otherStart, otherEnd) => start < otherEnd && end > otherStart;
const minutes = (time) => { const [hour, minute] = time.split(':').map(Number); return hour * 60 + minute; };
const clock = (time) => String(time).slice(0, 5);
const asNumber = (value) => typeof value === 'number' && Number.isInteger(value);

export function nextDate(date, days = 1) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  const value = result.toISOString().slice(0, 10);
  if (!validDate(value)) throw new AgendaError('A data ultrapassa o calendário permitido.');
  return value;
}

export function recurringOccurrence(row, date) {
  const start = clock(row.hora_inicio);
  const end = clock(row.hora_fim);
  return { ...row, inicio: `${date} ${start}:00`, fim: end === '24:00' ? `${nextDate(date)} 00:00:00` : `${date} ${end}:00` };
}

// A primeira ocorrência a partir do início também cobre consultas legadas que
// atravessam meia-noite ou vários dias, sem limitar a verificação a poucas semanas.
export function recurringOverlap(row, start, end) {
  const date = start.slice(0, 10);
  const offset = (Number(row.dia_semana) - weekday(date) + 7) % 7;
  const candidate = recurringOccurrence(row, nextDate(date, offset));
  if (overlaps(candidate.inicio, candidate.fim, start, end)) return candidate;
  if (offset === 0 && candidate.fim <= start) {
    const following = recurringOccurrence(row, nextDate(date, 7));
    if (overlaps(following.inicio, following.fim, start, end)) return following;
  }
  return null;
}

export function professionalId(value = 1) {
  if (!validId(value)) throw new AgendaError('Profissional inválido.');
  return Number(value);
}

export function validateWindow(body, { block = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AgendaError('Informe os dados do horário.');
  if (block) return validateBlock(body);
  const { hora_inicio, hora_fim } = body;
  if (!validTime(hora_inicio) || !validTime(hora_fim) || hora_inicio >= hora_fim) {
    throw new AgendaError('Informe um início anterior ao fim, no mesmo dia.');
  }
  const result = { profissional_id: professionalId(body.profissional_id), hora_inicio, hora_fim };
  if (block || body.tipo === 'extra') {
    if (!validDate(body.data)) throw new AgendaError('Informe uma data válida.');
    if (`${body.data} ${hora_inicio}:00` <= clinicNow()) throw new AgendaError('Escolha um horário futuro.');
    Object.assign(result, { data_especifica: body.data, dia_semana: weekday(body.data), inicio: `${body.data} ${hora_inicio}:00`, fim: `${body.data} ${hora_fim}:00` });
    if (block) {
      if (body.motivo != null && (typeof body.motivo !== 'string' || body.motivo.trim().length > 150)) throw new AgendaError('O motivo deve ter no máximo 150 caracteres.');
      result.motivo = body.motivo?.trim() || null;
    } else Object.assign(result, { duracao_minutos: minutes(hora_fim) - minutes(hora_inicio), intervalo_minutos: 0 });
  } else if (body.tipo === 'recorrente') {
    const { dia_semana, duracao_minutos = 50, intervalo_minutos = 10 } = body;
    if (!asNumber(dia_semana) || dia_semana < 0 || dia_semana > 6) throw new AgendaError('Escolha um dia da semana válido.');
    if (!asNumber(duracao_minutos) || duracao_minutos <= 0 || duracao_minutos > minutes(hora_fim) - minutes(hora_inicio)) {
      throw new AgendaError('A duração precisa caber no período de atendimento.');
    }
    if (!asNumber(intervalo_minutos) || intervalo_minutos < 0 || intervalo_minutos > 1440) throw new AgendaError('Informe um intervalo entre 0 e 1440 minutos.');
    Object.assign(result, { data_especifica: null, dia_semana, duracao_minutos, intervalo_minutos });
  } else throw new AgendaError('Escolha horário recorrente ou extra.');
  return result;
}

export function validateBlock(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AgendaError('Informe os dados do bloqueio.');
  if (body.dia_inteiro != null && typeof body.dia_inteiro !== 'boolean') throw new AgendaError('Informe se o bloqueio cobre o dia inteiro.');
  const tipo = body.tipo ?? 'data';
  if (!['data', 'recorrente'].includes(tipo)) throw new AgendaError('Escolha bloqueio por data ou recorrente.');
  const hora_inicio = body.dia_inteiro ? '00:00' : body.hora_inicio;
  const hora_fim = body.dia_inteiro ? '24:00' : body.hora_fim;
  if (!validTime(hora_inicio) || !(validTime(hora_fim) || hora_fim === '24:00') || hora_inicio >= hora_fim) throw new AgendaError('Informe um início anterior ao fim do bloqueio.');
  if (body.motivo != null && (typeof body.motivo !== 'string' || body.motivo.trim().length > 150)) throw new AgendaError('O motivo deve ter no máximo 150 caracteres.');
  const result = { profissional_id: professionalId(body.profissional_id), hora_inicio, hora_fim, motivo: body.motivo?.trim() || null, inicio: null, fim: null, dia_semana: null };
  if (tipo === 'recorrente') {
    if (!asNumber(body.dia_semana) || body.dia_semana < 0 || body.dia_semana > 6) throw new AgendaError('Escolha um dia da semana válido.');
    result.dia_semana = body.dia_semana;
  } else {
    if (!validDate(body.data)) throw new AgendaError('Informe uma data válida.');
    Object.assign(result, recurringOccurrence(result, body.data));
    // Um bloqueio do dia inteiro pode começar hoje; sua parte futura continua útil.
    if ((body.dia_inteiro ? result.fim : result.inicio) <= clinicNow()) throw new AgendaError('Escolha um horário futuro.');
  }
  return result;
}

export function serializeAvailability(row) {
  return { id: row.id, profissional_id: row.profissional_id, tipo: row.data_especifica ? 'extra' : 'recorrente', data: row.data_especifica || null, dia_semana: row.dia_semana, hora_inicio: clock(row.hora_inicio), hora_fim: clock(row.hora_fim), duracao_minutos: row.duracao_minutos, intervalo_minutos: row.intervalo_minutos };
}

export function serializeBlock(row) {
  const recurring = row.dia_semana != null;
  const start = recurring ? clock(row.hora_inicio) : row.inicio.slice(11, 16);
  const end = recurring ? clock(row.hora_fim) : row.fim.slice(0, 10) > row.inicio.slice(0, 10) && row.fim.slice(11, 16) === '00:00' ? '24:00' : row.fim.slice(11, 16);
  return { id: row.id, profissional_id: row.profissional_id, tipo: recurring ? 'recorrente' : 'data', dia_semana: row.dia_semana ?? null,
    data: row.inicio?.slice(0, 10) || null, hora_inicio: start, hora_fim: end, inicio: row.inicio || null, fim: row.fim || null,
    dia_inteiro: start === '00:00' && end === '24:00', motivo: row.motivo || null };
}

export async function loadDayBlocks(connection, date, id, { privateDetails = false } = {}) {
  const [rows] = await connection.query(`SELECT ${privateDetails ? 'id, profissional_id, motivo, ' : ''}inicio, fim, dia_semana, hora_inicio, hora_fim
    FROM bloqueios_agenda WHERE profissional_id = ? AND
    ((inicio < DATE_ADD(?, INTERVAL 1 DAY) AND fim > CONCAT(?, ' 00:00:00')) OR (inicio IS NULL AND dia_semana = ?))`, [id, date, date, weekday(date)]);
  return rows.map((row) => row.dia_semana != null ? recurringOccurrence(row, date) : row).sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export async function loadDayAvailability(connection, date, id) {
  const [rows] = await connection.query(`SELECT d.id, d.profissional_id, d.dia_semana, d.data_especifica,
    d.hora_inicio, d.hora_fim, d.duracao_minutos, d.intervalo_minutos
    FROM disponibilidades d WHERE d.profissional_id = ? AND d.ativo = 1
    AND EXISTS (SELECT 1 FROM profissionais p WHERE p.id = d.profissional_id AND p.ativo = 1)
    AND ((d.data_especifica IS NULL AND d.dia_semana = ?) OR d.data_especifica = ?)
    ORDER BY d.hora_inicio, d.id`, [id, weekday(date), date]);
  return rows;
}

export async function loadDaySchedule(connection, date, id, { privateDetails = false } = {}) {
  const availability = await loadDayAvailability(connection, date, id);
  const [appointments] = await connection.query(`SELECT inicio, fim FROM agendamentos WHERE profissional_id = ?
    AND inicio < DATE_ADD(?, INTERVAL 1 DAY) AND fim > CONCAT(?, ' 00:00:00')
    AND status IN ('agendado', 'confirmado')`, [id, date, date]);
  const blocks = await loadDayBlocks(connection, date, id, { privateDetails });
  const now = clinicNow();
  const horarios = generateSlots(availability).filter((slot) => {
    const start = `${date} ${slot.horario}:00`;
    const end = `${date} ${slot.fim}:00`;
    return start > now && ![...appointments, ...blocks].some((item) => overlaps(start, end, item.inicio, item.fim));
  });
  return { availability, blocks, horarios };
}

// A leitura administrativa traz um pequeno contexto futuro em vez de exigir
// uma consulta por data para exibir as próximas exceções no calendário.
export async function loadUpcomingExceptions(connection, id, limit = 8) {
  const now = clinicNow();
  const [extras] = await connection.query(`SELECT id, data_especifica, hora_inicio, hora_fim
    FROM disponibilidades WHERE profissional_id = ? AND ativo = 1 AND data_especifica IS NOT NULL
    AND TIMESTAMP(data_especifica, hora_fim) > ? ORDER BY data_especifica, hora_inicio, id LIMIT 20`, [id, now]);
  const [blocks] = await connection.query(`SELECT id, inicio, fim, motivo FROM bloqueios_agenda
    WHERE profissional_id = ? AND inicio IS NOT NULL AND fim > ? ORDER BY inicio, id LIMIT 20`, [id, now]);
  return [
    ...extras.map((row) => ({ id: row.id, tipo: 'extra', data: row.data_especifica, hora_inicio: clock(row.hora_inicio), hora_fim: clock(row.hora_fim), motivo: null })),
    ...blocks.map((row) => ({ id: row.id, tipo: 'bloqueio', data: row.inicio.slice(0, 10), hora_inicio: row.inicio.slice(11, 16), hora_fim: row.fim.slice(0, 10) > row.inicio.slice(0, 10) && row.fim.slice(11, 16) === '00:00' ? '24:00' : row.fim.slice(11, 16), motivo: row.motivo || null })),
  ].sort((first, second) => `${first.data} ${first.hora_inicio}`.localeCompare(`${second.data} ${second.hora_inicio}`)).slice(0, limit);
}

export async function assertNoActiveAppointment(connection, id, start, end) {
  const [rows] = await connection.query(`SELECT id FROM agendamentos WHERE profissional_id = ?
    AND status IN ('agendado', 'confirmado') AND inicio < ? AND fim > ? LIMIT 1`, [id, end, start]);
  if (rows.length) throw new AgendaError('Existe uma consulta marcada neste período.', 409);
}

export async function assertNoBlock(connection, id, start, end, ignoredId = 0) {
  const [rows] = await connection.query(`SELECT id, inicio, fim, dia_semana, hora_inicio, hora_fim FROM bloqueios_agenda WHERE profissional_id = ?
    AND id != ? AND ((inicio < ? AND fim > ?) OR inicio IS NULL)`, [id, ignoredId, end, start]);
  if (rows.some((row) => row.dia_semana == null || recurringOverlap(row, start, end))) throw new AgendaError('Já existe um horário ocupado neste período.', 409);
}

export async function assertBlockCompatible(connection, window, ignoredId = 0) {
  if (window.dia_semana == null) {
    await assertNoActiveAppointment(connection, window.profissional_id, window.inicio, window.fim);
    await assertNoBlock(connection, window.profissional_id, window.inicio, window.fim, ignoredId);
    return;
  }
  const appointments = await futureAppointments(connection, window.profissional_id);
  if (appointments.some((item) => recurringOverlap(window, item.inicio, item.fim))) throw new AgendaError('Existe uma consulta marcada neste período em uma das próximas semanas.', 409);
  const [blocks] = await connection.query(`SELECT inicio, fim, dia_semana, hora_inicio, hora_fim FROM bloqueios_agenda
    WHERE profissional_id = ? AND id != ? AND (fim > ? OR inicio IS NULL)`, [window.profissional_id, ignoredId, clinicNow()]);
  if (blocks.some((item) => item.dia_semana == null ? recurringOverlap(window, item.inicio, item.fim)
    : Number(item.dia_semana) === window.dia_semana && overlaps(window.hora_inicio, window.hora_fim, clock(item.hora_inicio), clock(item.hora_fim)))) {
    throw new AgendaError('Já existe um horário ocupado neste período.', 409);
  }
}

function slotMatchesAppointment(slot, appointment) {
  return `${slot.horario}:00` === appointment.inicio.slice(11) && `${slot.fim}:00` === appointment.fim.slice(11);
}

async function futureAppointments(connection, id) {
  const [rows] = await connection.query(`SELECT inicio, fim FROM agendamentos WHERE profissional_id = ?
    AND status IN ('agendado', 'confirmado') AND fim > ?`, [id, clinicNow()]);
  return rows;
}

// Uma rotina pode ser ajustada sem tocar em consultas que continuam tendo o mesmo slot.
export async function assertExistingBookingsRemainCovered(connection, previous, replacement) {
  if (!previous) return;
  if (previous.data_especifica) {
    await assertNoActiveAppointment(connection, previous.profissional_id, `${previous.data_especifica} ${clock(previous.hora_inicio)}:00`, `${previous.data_especifica} ${clock(previous.hora_fim)}:00`);
    return;
  }
  const appointments = await futureAppointments(connection, previous.profissional_id);
  const previousSlots = generateSlots([previous]);
  for (const appointment of appointments) {
    if (!previousSlots.some((slot) => recurringOverlap({ dia_semana: previous.dia_semana, hora_inicio: slot.horario, hora_fim: slot.fim }, appointment.inicio, appointment.fim))) continue;
    const date = appointment.inicio.slice(0, 10);
    const remaining = (await loadDayAvailability(connection, date, previous.profissional_id)).filter((row) => row.id !== previous.id);
    if (replacement && (replacement.data_especifica === date || (!replacement.data_especifica && replacement.dia_semana === weekday(date)))) remaining.push(replacement);
    if (!generateSlots(remaining).some((slot) => slotMatchesAppointment(slot, appointment))) {
      throw new AgendaError('Existe uma consulta marcada neste período. Mantenha o horário dessa consulta antes de alterar a rotina.', 409);
    }
  }
}

export async function assertAvailabilityCompatible(connection, window, ignoredId = 0) {
  const id = window.profissional_id;
  if (window.data_especifica) {
    await assertNoActiveAppointment(connection, id, window.inicio, window.fim);
    await assertNoBlock(connection, id, window.inicio, window.fim);
    const others = (await loadDayAvailability(connection, window.data_especifica, id)).filter((row) => row.id !== ignoredId);
    if (generateSlots(others).some((slot) => overlaps(window.hora_inicio, window.hora_fim, slot.horario, slot.fim))) {
      throw new AgendaError('Já existe um horário disponível neste período. Escolha um intervalo sem sobreposição.', 409);
    }
    return;
  }
  const slots = generateSlots([window]);
  const [recurring] = await connection.query(`SELECT hora_inicio, hora_fim, duracao_minutos, intervalo_minutos FROM disponibilidades WHERE profissional_id = ? AND ativo = 1
    AND data_especifica IS NULL AND dia_semana = ? AND id != ?`, [id, window.dia_semana, ignoredId]);
  if (generateSlots(recurring).some((other) => slots.some((slot) => overlaps(slot.horario, slot.fim, other.horario, other.fim)))) throw new AgendaError('Já existe um período recorrente nesse dia e horário.', 409);
  const appointments = await futureAppointments(connection, id);
  for (const appointment of appointments) {
    const colliding = slots.map((slot) => recurringOverlap({ dia_semana: window.dia_semana, hora_inicio: slot.horario, hora_fim: slot.fim }, appointment.inicio, appointment.fim)).filter(Boolean);
    if (colliding.some((occurrence) => occurrence.inicio !== appointment.inicio || occurrence.fim !== appointment.fim)) {
      throw new AgendaError('Existe uma consulta marcada neste período com início ou duração diferente.', 409);
    }
  }
  const [extras] = await connection.query(`SELECT hora_inicio, hora_fim FROM disponibilidades WHERE profissional_id = ? AND ativo = 1
    AND data_especifica IS NOT NULL AND TIMESTAMP(data_especifica, hora_fim) > ? AND dia_semana = ? AND id != ?`, [id, clinicNow(), window.dia_semana, ignoredId]);
  for (const extra of extras) {
    if (slots.some((slot) => overlaps(slot.horario, slot.fim, clock(extra.hora_inicio), clock(extra.hora_fim)) && (slot.horario !== clock(extra.hora_inicio) || slot.fim !== clock(extra.hora_fim)))) {
      throw new AgendaError('Existe um horário extra incompatível em uma das próximas datas desse dia da semana.', 409);
    }
  }
}
