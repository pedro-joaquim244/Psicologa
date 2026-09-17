export const TOKEN_KEY = "psicologa_token";
export const USER_KEY = "psicologa_usuario";
export const PATIENT_TOKEN_KEY = 'paciente_token';
export const PATIENT_USER_KEY = 'paciente_usuario';
const keys = (audience) => audience === 'paciente' ? [PATIENT_TOKEN_KEY, PATIENT_USER_KEY] : [TOKEN_KEY, USER_KEY];

// Migra somente pacientes que entraram antes da separação das chaves.
function migratePatientSession() {
  try {
    const user = JSON.parse(localStorage.getItem(USER_KEY));
    const token = localStorage.getItem(TOKEN_KEY);
    if (user?.tipo !== 'paciente') return;
    if (token && !localStorage.getItem(PATIENT_TOKEN_KEY)) saveStoredSession(token, user);
    clearStoredSession('profissional');
  } catch { /* A leitura abaixo descarta sessões malformadas. */ }
}

export function getStoredSession(audience = 'profissional') {
  migratePatientSession();
  const [tokenKey, userKey] = keys(audience);
  try {
    const token = localStorage.getItem(tokenKey);
    const userValue = localStorage.getItem(userKey);
    if (!token || !userValue) return { token: null, user: null };
    const user = JSON.parse(userValue);
    const validRole = audience === 'paciente' ? user?.tipo === 'paciente' : ['psicologa', 'admin'].includes(user?.tipo);
    if (!validRole) throw new Error('Sessão inválida');
    return { token, user };
  } catch {
    clearStoredSession(audience);
    return { token: null, user: null };
  }
}

export function saveStoredSession(token, user) {
  const [tokenKey, userKey] = keys(user.tipo === 'paciente' ? 'paciente' : 'profissional');
  localStorage.setItem(tokenKey, token);
  localStorage.setItem(userKey, JSON.stringify(user));
}

export function clearStoredSession(audience = 'profissional') {
  keys(audience).forEach((key) => localStorage.removeItem(key));
}

export function clearSessionForToken(token) {
  for (const audience of ['paciente', 'profissional']) {
    if (getStoredSession(audience).token === token) clearStoredSession(audience);
  }
}
