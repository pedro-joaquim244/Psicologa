import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/admin/ProtectedRoute";
import Home from "./pages/Home";
import LoginAdmin from "./pages/admin/LoginAdmin";
import AgendaAdmin from "./pages/admin/AgendaAdmin";
import ProtectedPatientRoute from './components/patient/ProtectedPatientRoute';
import MinhasConsultas from './pages/MinhasConsultas';
import MinhaConta from './pages/MinhaConta';

export default function App() {
  const basename = import.meta.env.BASE_URL === "/"
    ? undefined
    : import.meta.env.BASE_URL;

  return (
    <BrowserRouter basename={basename}>
      <AuthProvider>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
