import { clinicNow, generateSlots, validDate, validId, validTime } from '../utils/scheduling.js';

export class AgendaError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export const weekday = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
export const overlaps = (start, end, otherStart, otherEnd) => start < otherEnd && end > otherStart;
const minutes = (time) => { const [hour, minute] = time.split(':').map(Number); return hour * 60 + minute; };
const clock = (time) => String(time).slice(0, 5);
const asNumber = (value) => typeof value === 'number' && Number.isInteger(value);

export function professionalId(value = 1) {
  if (!validId(value)) throw new AgendaError('Profissional inválido.');
  return Number(value);
}

export function validateWindow(body, { block = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AgendaError('Informe os dados do horário.');
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

export function serializeAvailability(row) {
  return { id: row.id, profissional_id: row.profissional_id, tipo: row.data_especifica ? 'extra' : 'recorrente', data: row.data_especifica || null, dia_semana: row.dia_semana, hora_inicio: clock(row.hora_inicio), hora_fim: clock(row.hora_fim), duracao_minutos: row.duracao_minutos, intervalo_minutos: row.intervalo_minutos };
}

export function serializeBlock(row) {
  return { id: row.id, profissional_id: row.profissional_id, data: row.inicio.slice(0, 10), hora_inicio: row.inicio.slice(11, 16), hora_fim: row.fim.slice(11, 16), inicio: row.inicio, fim: row.fim, motivo: row.motivo || null };
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
  const [blocks] = await connection.query(`SELECT ${privateDetails ? 'id, profissional_id, motivo, ' : ''}inicio, fim FROM bloqueios_agenda
    WHERE profissional_id = ? AND inicio < DATE_ADD(?, INTERVAL 1 DAY) AND fim > CONCAT(?, ' 00:00:00') ORDER BY inicio`, [id, date, date]);
  const now = clinicNow();
  const horarios = generateSlots(availability).filter((slot) => {
    const start = `${date} ${slot.horario}:00`;
    const end = `${date} ${slot.fim}:00`;
    return start > now && ![...appointments, ...blocks].some((item) => overlaps(start, end, item.inicio, item.fim));
  });
  return { availability, blocks, horarios };
}

export async function assertNoActiveAppointment(connection, id, start, end) {
  const [rows] = await connection.query(`SELECT id FROM agendamentos WHERE profissional_id = ?
    AND status IN ('agendado', 'confirmado') AND inicio < ? AND fim > ? LIMIT 1`, [id, end, start]);
  if (rows.length) throw new AgendaError('Existe uma consulta marcada neste período.', 409);
}

export async function assertNoBlock(connection, id, start, end, ignoredId = 0) {
  const [rows] = await connection.query(`SELECT id FROM bloqueios_agenda WHERE profissional_id = ?
    AND inicio < ? AND fim > ? AND id != ? LIMIT 1`, [id, end, start, ignoredId]);
  if (rows.length) throw new AgendaError('Já existe um horário ocupado neste período.', 409);
}

function slotMatchesAppointment(slot, appointment) {
  return `${slot.horario}:00` === appointment.inicio.slice(11) && `${slot.fim}:00` === appointment.fim.slice(11);
}

async function futureAppointments(connection, id, day) {
  const [rows] = await connection.query(`SELECT inicio, fim FROM agendamentos WHERE profissional_id = ?
    AND status IN ('agendado', 'confirmado') AND fim > ? AND DAYOFWEEK(inicio) - 1 = ?`, [id, clinicNow(), day]);
  return rows;
}

// Uma rotina pode ser ajustada sem tocar em consultas que continuam tendo o mesmo slot.
export async function assertExistingBookingsRemainCovered(connection, previous, replacement) {
  if (!previous) return;
  if (previous.data_especifica) {
    await assertNoActiveAppointment(connection, previous.profissional_id, `${previous.data_especifica} ${clock(previous.hora_inicio)}:00`, `${previous.data_especifica} ${clock(previous.hora_fim)}:00`);
    return;
  }
  const appointments = await futureAppointments(connection, previous.profissional_id, previous.dia_semana);
  const previousSlots = generateSlots([previous]);
  for (const appointment of appointments) {
    if (!previousSlots.some((slot) => overlaps(`${slot.horario}:00`, `${slot.fim}:00`, appointment.inicio.slice(11), appointment.fim.slice(11)))) continue;
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
  const [recurring] = await connection.query(`SELECT id FROM disponibilidades WHERE profissional_id = ? AND ativo = 1
    AND data_especifica IS NULL AND dia_semana = ? AND id != ? AND hora_inicio < ? AND hora_fim > ? LIMIT 1`,
  [id, window.dia_semana, ignoredId, window.hora_fim, window.hora_inicio]);
  if (recurring.length) throw new AgendaError('Já existe um período recorrente nesse dia e horário.', 409);
  const slots = generateSlots([window]);
  const appointments = await futureAppointments(connection, id, window.dia_semana);
  for (const appointment of appointments) {
    const colliding = slots.filter((slot) => overlaps(`${slot.horario}:00`, `${slot.fim}:00`, appointment.inicio.slice(11), appointment.fim.slice(11)));
    if (colliding.some((slot) => !slotMatchesAppointment(slot, appointment))) {
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
