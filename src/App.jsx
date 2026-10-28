import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/admin/ProtectedRoute";
import ProtectedPatientRoute from './components/patient/ProtectedPatientRoute';
import { ThemeProvider } from './context/ThemeContext';
import ScrollManager from './components/Shared/ScrollManager';

const Home = lazy(() => import('./pages/Home'));
const LoginAdmin = lazy(() => import('./pages/admin/LoginAdmin'));
const AgendaAdmin = lazy(() => import('./pages/admin/AgendaAdmin'));
const MinhasConsultas = lazy(() => import('./pages/MinhasConsultas'));
const MinhaConta = lazy(() => import('./pages/MinhaConta'));
const Privacidade = lazy(() => import('./pages/Privacidade'));

export default function App() {
  const basename = import.meta.env.BASE_URL === "/"
    ? undefined
    : import.meta.env.BASE_URL;

  return (
    <BrowserRouter basename={basename}>
      <ThemeProvider>
        <AuthProvider>
          <Suspense fallback={<main className="route-loading" role="status">Carregando…</main>}>
            <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/adm/login" element={<LoginAdmin />} />
            <Route path="/adm" element={<Navigate to="/adm/login" replace />} />
            <Route path="/login" element={<LoginAdmin key="paciente" audience="paciente" />} />
            <Route path="/cadastro" element={<LoginAdmin key="cadastro" audience="paciente" registering />} />
            <Route element={<ProtectedPatientRoute />}>
              <Route path="/minhas-consultas" element={<MinhasConsultas />} />
              <Route path="/minha-conta" element={<MinhaConta />} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route path="/adm/agenda" element={<AgendaAdmin />} />
            </Route>
            <Route path="/privacidade" element={<Privacidade />} />
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <ScrollManager />
          </Suspense>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
