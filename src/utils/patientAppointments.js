import { normalizeStatus, parseApiDate } from './adminFormatters';

export const PATIENT_STATUS = {
  agendado: { label: 'Agendada', category: 'marcadas' },
  confirmado: { label: 'Confirmada', category: 'marcadas' },
  concluido: { label: 'Realizada', category: 'realizadas' },
  cancelado: { label: 'Cancelada', category: 'canceladas' },
};
export const PATIENT_FILTERS = [['todas', 'Todas'], ['marcadas', 'Marcadas'], ['realizadas', 'Realizadas'], ['canceladas', 'Canceladas']];
export const patientStatus = (item) => PATIENT_STATUS[normalizeStatus(item.status)] || { label: 'Não informado', category: 'outros' };

// MySQL DATETIME é o horário de parede do consultório, sem conversão implícita para UTC.
const clinicClock = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const wallTime = (value) => String(value || '').replace('T', ' ').slice(0, 19);
export const isUpcoming = (item, now = new Date()) => patientStatus(item).category === 'marcadas' && wallTime(item.fim) >= clinicClock.format(now);

export function sortPatientAppointments(items, now = new Date()) {
  return [...items].sort((a, b) => {
    const nextA = isUpcoming(a, now);
    const nextB = isUpcoming(b, now);
    if (nextA !== nextB) return nextA ? -1 : 1;
    const comparison = wallTime(a.inicio).localeCompare(wallTime(b.inicio));
    return (nextA ? comparison : -comparison) || Number(a.id) - Number(b.id);
  });
}

export function dateStamp(value) {
  const date = parseApiDate(value);
  return date ? { day: String(date.getDate()).padStart(2, '0'), month: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), year: date.getFullYear() } : { day: '—', month: '', year: '' };
}
