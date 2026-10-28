import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPatientAccount } from '../services/api';
import { formatPhone } from '../utils/adminFormatters';
import PatientLayout from '../components/patient/PatientLayout';

export default function MinhaConta() {
  const { token, updatePatientProfile } = useAuth();
  const [account, setAccount] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ nome: '', telefone: '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    getPatientAccount(token, { signal: controller.signal }).then((data) => setAccount(data.usuario)).catch((failure) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [token, retry]);

  const beginEditing = () => { setValues({ nome: account.nome, telefone: account.telefone }); setNotice(''); setEditing(true); };
  const cancelEditing = () => { setEditing(false); setNotice(''); };
  const saveProfile = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (values.nome.trim().length < 3 || !/^\d{10,13}$/.test(values.telefone.replace(/\D/g, ''))) { setNotice('Informe nome completo e WhatsApp com DDD.'); return; }
    setSaving(true); setNotice('');
    try {
      const updated = await updatePatientProfile({ nome: values.nome.trim(), telefone: values.telefone.replace(/\D/g, '') });
      setAccount(updated); setEditing(false); setNotice('Dados atualizados.');
    } catch (failure) { setNotice(failure.message); }
    finally { setSaving(false); }
  };

  return <PatientLayout label="Minha conta" title={<>Um espaço<br /><em>que é seu.</em></>} description="Estes são os dados da sua conta, utilizados para identificar seus agendamentos.">
    {error ? <div className="patient-state" role="alert"><p>{error}</p><button className="text-link" type="button" onClick={() => setRetry((value) => value + 1)}>Tentar novamente</button></div> : !account ? <p className="patient-state" role="status">Buscando seus dados…</p> : editing ? <form className="patient-account-form" onSubmit={saveProfile} noValidate><div className="patient-account"><label><span>Nome completo</span><input type="text" autoComplete="name" value={values.nome} onChange={(event) => setValues((current) => ({ ...current, nome: event.target.value }))} disabled={saving} required /></label><label><span>WhatsApp</span><input type="tel" autoComplete="tel" inputMode="tel" value={values.telefone} onChange={(event) => setValues((current) => ({ ...current, telefone: event.target.value }))} disabled={saving} required /></label><div><span>E-mail</span><p>{account.email}</p><small>O e-mail é a identidade verificada da conta e não pode ser alterado aqui.</small></div></div>{notice && <p className="patient-error" role="alert">{notice}</p>}<div className="patient-form-actions"><button className="button button-dark" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar dados'}</button><button className="text-link" type="button" onClick={cancelEditing} disabled={saving}>Cancelar</button></div></form> : <><dl className="patient-account"><div><dt>Nome completo</dt><dd>{account.nome}</dd></div><div><dt>E-mail</dt><dd>{account.email}</dd></div><div><dt>WhatsApp</dt><dd>{formatPhone(account.telefone)}</dd></div></dl><button className="text-link patient-edit-trigger" type="button" onClick={beginEditing}>Editar dados <i className="bi bi-pencil" aria-hidden="true" /></button>{notice && <p className="patient-notice" role="status">{notice}</p>}</>}
    <Link className="text-link" to="/minhas-consultas">Minhas consultas <i className="bi bi-arrow-up-right" aria-hidden="true" /></Link>
  </PatientLayout>;
}
