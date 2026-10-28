import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from 'react-router-dom';
import { AUTH_EXPIRED_EVENT, getPublicConfig, loginAdmin, loginDemo, loginPatient, registerPatient, updatePatientAccount, verifyEmail } from "../services/api";
import { clearStoredSession, getStoredSession, saveStoredSession } from "../services/authStorage";

const AuthContext = createContext(null);
const readSessions = () => ({ paciente: getStoredSession('paciente'), profissional: getStoredSession('profissional') });
const defaultPublicConfig = { ready: false, demoMode: false, emailDelivery: false, publicRegistration: false, demoAccess: { paciente: false, profissional: false } };

export function AuthProvider({ children }) {
  const [sessions, setSessions] = useState(readSessions);
  const [publicConfig, setPublicConfig] = useState(defaultPublicConfig);
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

  useEffect(() => {
    const controller = new AbortController();
    getPublicConfig({ signal: controller.signal })
      .then((config) => setPublicConfig({ ...defaultPublicConfig, ...config, ready: true }))
      .catch((error) => {
        if (error.name !== 'AbortError') setPublicConfig({ ...defaultPublicConfig, ready: true, unavailable: true });
      });
    return () => controller.abort();
  }, []);

  const value = useMemo(() => ({
    ...session,
    isAuthenticated: Boolean(session.token),
    isProfessional: Boolean(session.token && ['psicologa', 'admin'].includes(session.user?.tipo)),
    isPatient: Boolean(session.token && session.user?.tipo === 'paciente'),
    publicConfig,
    async login(credentials, audience = 'profissional') {
      const data = await (audience === 'paciente' ? loginPatient(credentials) : loginAdmin(credentials));
      if (!data?.token || !data?.usuario?.email_verificado) throw new Error('A API retornou uma sessão inválida.');
      saveStoredSession(data.token, data.usuario);
      setSessions(readSessions());
      return data;
    },
    async loginDemoAccount(audience = 'paciente') {
      const data = await loginDemo(audience);
      if (!data?.token || !data?.usuario?.email_verificado) throw new Error('A API retornou uma sessão demonstrativa inválida.');
      saveStoredSession(data.token, data.usuario);
      setSessions(readSessions());
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
    async updatePatientProfile(details) {
      if (!session.token || session.user?.tipo !== 'paciente') throw new Error('Entre novamente para atualizar seus dados.');
      const data = await updatePatientAccount(details, session.token);
      if (!data?.usuario?.id) throw new Error('A resposta não confirmou a atualização da conta.');
      saveStoredSession(session.token, data.usuario);
      setSessions(readSessions());
      return data.usuario;
    },
    logout() {
      clearStoredSession(audience);
      setSessions(readSessions());
    },
  }), [session, audience, publicConfig]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth precisa ser usado dentro de AuthProvider.");
  return value;
}
