import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute() {
  const { isProfessional } = useAuth();
  const location = useLocation();
  return isProfessional ? <Outlet /> : <Navigate to="/adm/login" replace state={{ from: location.pathname }} />;
}
