import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPatientAccount } from '../services/api';
import { formatPhone } from '../utils/adminFormatters';
import PatientLayout from '../components/patient/PatientLayout';

export default function MinhaConta() {
  const { token } = useAuth();
  const [account, setAccount] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    getPatientAccount(token, { signal: controller.signal }).then((data) => setAccount(data.usuario)).catch((failure) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [token, retry]);

  return <PatientLayout label="Minha conta" title={<>Um espaço<br /><em>que é seu.</em></>} description="Estes são os dados da sua conta, utilizados para identificar seus agendamentos.">
    {error ? <div className="patient-state" role="alert"><p>{error}</p><button className="text-link" type="button" onClick={() => setRetry((value) => value + 1)}>Tentar novamente</button></div> : !account ? <p className="patient-state" role="status">Buscando seus dados…</p> : <dl className="patient-account"><div><dt>Nome completo</dt><dd>{account.nome}</dd></div><div><dt>E-mail</dt><dd>{account.email}</dd></div><div><dt>WhatsApp</dt><dd>{formatPhone(account.telefone)}</dd></div></dl>}
    <Link className="text-link" to="/minhas-consultas">Minhas consultas <i className="bi bi-arrow-up-right" aria-hidden="true" /></Link>
  </PatientLayout>;
}
