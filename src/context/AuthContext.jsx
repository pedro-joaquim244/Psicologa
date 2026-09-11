import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AUTH_EXPIRED_EVENT, loginAdmin, loginPatient, registerPatient, verifyEmail } from "../services/api";
import { clearStoredSession, getStoredSession, saveStoredSession } from "../services/authStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(getStoredSession);

  useEffect(() => {
    const expire = () => setSession({ token: null, user: null });
    window.addEventListener(AUTH_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, expire);
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
      setSession({ token: data.token, user: data.usuario });
    },
    logout() {
      clearStoredSession();
      setSession({ token: null, user: null });
    },
  }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth precisa ser usado dentro de AuthProvider.");
  return value;
}
