import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from 'react-router-dom';
import { AUTH_EXPIRED_EVENT, loginAdmin, loginPatient, registerPatient, verifyEmail } from "../services/api";
import { clearStoredSession, getStoredSession, saveStoredSession } from "../services/authStorage";

const AuthContext = createContext(null);
const readSessions = () => ({ paciente: getStoredSession('paciente'), profissional: getStoredSession('profissional') });

export function AuthProvider({ children }) {
  const [sessions, setSessions] = useState(readSessions);
  const { pathname } = useLocation();
  const audience = pathname.startsWith('/adm') || (pathname === '/' && !sessions.paciente.token && sessions.profissional.token) ? 'profissional' : 'paciente';
  const session = sessions[audience];

  useEffect(() => {
    const expire = () => setSessions(readSessions());
    window.addEventListener(AUTH_EXPIRED_EVENT, expire);
    window.addEventListener('storage', expire);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, expire);
      window.removeEventListener('storage', expire);
    };
  }, []);

  const value = useMemo(() => ({
    ...session,
    isAuthenticated: Boolean(session.token),
    isProfessional: Boolean(session.token && ['psicologa', 'admin'].includes(session.user?.tipo)),
    isPatient: Boolean(session.token && session.user?.tipo === 'paciente'),
    async login(credentials, audience = 'profissional') {
      const data = await (audience === 'paciente' ? loginPatient(credentials) : loginAdmin(credentials));
      if (!data?.verificacaoPendente || !data?.desafio) throw new Error('Não foi possível iniciar a verificação do e-mail.');
      return data;
    },
    async register(details) {
      const data = await registerPatient(details);
      if (!data?.verificacaoPendente || !data?.desafio) throw new Error('Não foi possível iniciar a verificação do e-mail.');
      return data;
    },
    async confirmEmail(details, audience) {
      const data = await verifyEmail(details, audience);
      if (!data?.token || !data?.usuario?.email_verificado) throw new Error('A API retornou uma sessão inválida.');
      saveStoredSession(data.token, data.usuario);
      setSessions(readSessions());
    },
    logout() {
      clearStoredSession(audience);
      setSessions(readSessions());
    },
  }), [session, audience]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth precisa ser usado dentro de AuthProvider.");
  return value;
}
