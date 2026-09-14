// DATETIME representa o relógio do consultório, independentemente do fuso do servidor.
const clinicClock = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
export const clinicNow = (now = new Date()) => clinicClock.format(now);
export const validId = (value) => (typeof value === 'string' || typeof value === 'number') && /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) <= 4294967295;
export function validDate(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export const validTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const minutes = (value) => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
const clock = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

// Uma única geração de slots para leitura e reserva, sem loops com passo zero.
export function generateSlots(availability) {
  const slots = new Map();
  for (const item of availability) {
    const startTime = String(item.hora_inicio).slice(0, 5);
    const endTime = String(item.hora_fim).slice(0, 5);
    const duration = Number(item.duracao_minutos);
    const interval = Number(item.intervalo_minutos);
    if (!validTime(startTime) || !validTime(endTime) || !Number.isInteger(duration) || duration <= 0 || !Number.isInteger(interval) || interval < 0) continue;
    for (let start = minutes(startTime); start + duration <= minutes(endTime); start += duration + interval) {
      const horario = clock(start);
      if (!slots.has(horario)) slots.set(horario, { horario, fim: clock(start + duration) });
    }
  }
  return [...slots.values()].sort((a, b) => a.horario.localeCompare(b.horario));
}
