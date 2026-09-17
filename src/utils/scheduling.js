export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const clinicFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
export const clinicNow = (date = new Date()) => clinicFormatter.format(date);
export const clinicDateKey = () => clinicNow().slice(0, 10);

export function dateFromKey(value) {
  return new Date(`${value}T12:00:00`);
}

export function bookingDateLabel(value) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(dateFromKey(value));
}

export function validateBooking(values) {
  const errors = {};
  if (values.nome.trim().length < 3) errors.nome = 'Informe seu nome completo.';
  if (!/^\d{10,13}$/.test(values.telefone.replace(/\D/g, ''))) errors.telefone = 'Informe seu WhatsApp com DDD.';
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Confira o endereço de e-mail.';
  if (!['online', 'presencial'].includes(values.modalidade)) errors.modalidade = 'Escolha a modalidade.';
  return errors;
}
