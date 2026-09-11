export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

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
