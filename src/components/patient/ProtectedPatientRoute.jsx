import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedPatientRoute() {
  const { isPatient, token } = useAuth();
  const location = useLocation();
  return isPatient ? <Outlet key={token} /> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}
