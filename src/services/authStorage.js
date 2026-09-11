export const TOKEN_KEY = "psicologa_token";
export const USER_KEY = "psicologa_usuario";

export function getStoredSession() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userValue = localStorage.getItem(USER_KEY);
    if (!token || !userValue) return { token: null, user: null };
    const user = JSON.parse(userValue);
    if (!user || typeof user !== "object") throw new Error("Sessão inválida");
    return { token, user };
  } catch {
    clearStoredSession();
    return { token: null, user: null };
  }
}

export function saveStoredSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
