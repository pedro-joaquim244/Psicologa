const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

export const STATUS_META = {
  agendado: { label: "Agendado", action: "confirmar" },
  confirmado: { label: "Confirmado", action: "concluir" },
  concluido: { label: "Concluído" },
  cancelado: { label: "Cancelado" },
};

export function parseApiDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLongDate(value) {
  const date = parseApiDate(value);
  return date ? dateFormatter.format(date) : "Data não informada";
}

export function formatWeekday(value) {
  const date = parseApiDate(value);
  if (!date) return "";
  const formatted = weekdayFormatter.format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatShortDate(value) {
  const date = parseApiDate(value);
  return date ? shortDateFormatter.format(date).replace(".", "") : "—";
}

export function formatTime(value) {
  const date = parseApiDate(value);
  return date ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
}

export function formatTimeRange(start, end) {
  return `${formatTime(start)} — ${formatTime(end)}`;
}

export function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value || "Não informado";
}

export function isSameLocalDay(value, reference = new Date()) {
  const date = parseApiDate(value);
  return Boolean(date && date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth() && date.getDate() === reference.getDate());
}

export function getGreetingName(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Dra. Helena";
  return /^(dra?\.?|psicóloga)$/i.test(parts[0]) && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0];
}

export function normalizeStatus(value) {
  return String(value || "agendado").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
