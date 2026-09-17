export const WEEKDAYS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

// A agenda é apresentada na ordem de trabalho mais natural, sem alterar a
// convenção do JavaScript/API (0 = domingo).
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const timeToMinutes = (value) => {
  const match = String(value || '').slice(0, 5).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.NaN;
};

const clock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export const SLOT_PERIODS = [
  { key: 'morning', label: 'Manhã', from: 0, until: 12 * 60 },
  { key: 'afternoon', label: 'Tarde', from: 12 * 60, until: 18 * 60 },
  { key: 'night', label: 'Noite', from: 18 * 60, until: 24 * 60 },
];

export function previewPeriod(period) {
  return expandPeriods([{ id: 'preview', ...period }]);
}

export function groupSlotsByPeriod(slots = []) {
  return SLOT_PERIODS.map((period) => ({
    ...period,
    slots: slots.filter((slot) => {
      const time = timeToMinutes(slot.horario);
      return Number.isFinite(time) && time >= period.from && time < period.until;
    }),
  })).filter((period) => period.slots.length);
}

/**
 * Expande períodos de disponibilidade no mesmo formato de slots retornado
 * pela API. Manter esta lógica no cliente evita que a seleção em massa trate
 * um período de quatro consultas como se fosse apenas um horário.
 */
export function expandPeriods(periods = []) {
  if (!Array.isArray(periods)) return [];

  const slots = [];
  for (const period of periods) {
    const start = timeToMinutes(period?.hora_inicio);
    const end = timeToMinutes(period?.hora_fim);
    const duration = Number(period?.duracao_minutos);
    const interval = Number(period?.intervalo_minutos ?? 0);
    const step = duration + interval;

    if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start
      || !Number.isInteger(duration) || duration <= 0
      || !Number.isInteger(interval) || interval < 0 || step <= 0) continue;

    // O limite evita travar a tela se uma resposta inválida chegar da API.
    let count = 0;
    for (let at = start; at + duration <= end && count < 500; at += step, count += 1) {
      const horario = clock(at);
      slots.push({
        ...period,
        horario,
        fim: clock(at + duration),
        key: `${period.id ?? `${period.data || period.dia_semana || 'periodo'}-${period.hora_inicio}`}-${horario}`,
      });
    }
  }

  return slots.sort((first, second) => first.horario.localeCompare(second.horario)
    || String(first.id ?? '').localeCompare(String(second.id ?? '')));
}
