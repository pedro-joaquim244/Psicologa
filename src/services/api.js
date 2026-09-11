import { clearStoredSession } from "./authStorage";

export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3333").replace(/\/$/, "");
export const AUTH_EXPIRED_EVENT = "psicologa:auth-expired";

export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function apiRequest(path, { token, body, headers, ...options } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError("Não foi possível conectar à API. Verifique se o servidor está disponível.");
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (response.status === 401 && token) {
    clearStoredSession();
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }

  if (!response.ok) {
    const message = data?.erro || data?.mensagem || data?.message || "Não foi possível concluir a solicitação.";
    throw new ApiError(message, response.status, data);
  }

  return data;
}

export function loginAdmin(credentials, options = {}) {
  return apiRequest("/api/auth/login", { method: "POST", body: credentials, ...options });
}

export async function listAppointments(token, options = {}) {
  const data = await apiRequest("/api/agendamentos", { method: "GET", token, ...options });
  const appointments = Array.isArray(data) ? data : data?.agendamentos;
  if (!Array.isArray(appointments)) throw new ApiError("Não foi possível ler a agenda. Tente novamente.");
  return appointments;
}

export function getAppointment(id, token, options = {}) {
  return apiRequest(`/api/agendamentos/${encodeURIComponent(id)}`, { method: "GET", token, ...options });
}

export function updateAppointmentStatus(id, action, token, options = {}) {
  return apiRequest(`/api/agendamentos/${encodeURIComponent(id)}/${action}`, { method: "PATCH", token, ...options });
}

export async function listAvailableSlots(date, options = {}) {
  const data = await apiRequest(`/api/horarios?${new URLSearchParams({ data: date })}`, options);
  if (!Array.isArray(data?.horarios)) throw new ApiError("Não foi possível ler os horários disponíveis. Tente novamente.");
  return data.horarios;
}

export async function createAppointment(details, token) {
  const data = await apiRequest("/api/agendamentos", { method: "POST", body: details, token });
  if (!data?.agendamento?.id) throw new ApiError("A resposta não confirmou a reserva. Entre em contato antes de tentar novamente.");
  return data.agendamento;
}

export function loginPatient(credentials) {
  return apiRequest('/api/pacientes/login', { method: 'POST', body: credentials });
}

export function registerPatient(details) {
  return apiRequest('/api/pacientes/cadastro', { method: 'POST', body: details });
}

export function verifyEmail(details, audience) {
  return apiRequest(`/api/${audience === 'paciente' ? 'pacientes' : 'auth'}/verificar-email`, { method: 'POST', body: details });
}

export function resendEmailCode(desafio, audience) {
  return apiRequest(`/api/${audience === 'paciente' ? 'pacientes' : 'auth'}/reenviar-codigo`, { method: 'POST', body: { desafio } });
}
