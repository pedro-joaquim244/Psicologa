import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { cancelPatientAppointment, listPatientAppointments } from '../services/api';
import { formatLongDate, formatTime } from '../utils/adminFormatters';
import { isUpcoming, PATIENT_FILTERS, patientStatus, sortPatientAppointments } from '../utils/patientAppointments';
import PatientLayout from '../components/patient/PatientLayout';
import AppointmentItem from '../components/patient/AppointmentItem';
import ConfirmationModal from '../components/admin/ConfirmationModal';
import SectionLink from '../components/Shared/SectionLink';
import '../styles/admin.css';

export default function MinhasConsultas() {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [filter, setFilter] = useState('todas');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [notice, setNotice] = useState('');
  const filterRef = useRef(null);
  const closeModal = useCallback(() => { setCancelling(null); setCancelError(''); }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    listPatientAppointments(token, { signal: controller.signal })
      .then(setAppointments)
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, retry]);

  const counts = useMemo(() => appointments.reduce((result, item) => {
    result.todas++;
    const category = patientStatus(item).category;
    if (category in result) result[category]++;
    return result;
  }, { todas: 0, marcadas: 0, realizadas: 0, canceladas: 0 }), [appointments]);
  const visible = sortPatientAppointments(appointments.filter((item) => filter === 'todas' || patientStatus(item).category === filter));
  const groups = filter === 'todas' ? [
    ['Próximos encontros', visible.filter((item) => isUpcoming(item))],
    ['Histórico', visible.filter((item) => !isUpcoming(item))],
  ] : [[PATIENT_FILTERS.find(([key]) => key === filter)[1], visible]];

  async function confirmCancel() {
    if (busy) return;
    setBusy(true); setCancelError('');
    try {
      const updated = await cancelPatientAppointment(cancelling.id, token);
      setAppointments((current) => current.map((item) => item.id === updated.id ? updated : item));
      setCancelling(null);
      setNotice('Consulta cancelada. Você pode encontrá-la em Canceladas.');
      requestAnimationFrame(() => filterRef.current?.querySelector('[aria-pressed="true"]')?.focus());
    } catch (failure) {
      setCancelError(failure.message);
    } finally { setBusy(false); }
  }

  return <PatientLayout label="Minhas consultas" title={<>Seus encontros,<br /><em>no seu ritmo.</em></>} description="Acompanhe suas consultas, veja os detalhes de cada encontro e organize seus próximos passos.">
    <div className="patient-filters" role="group" aria-label="Filtrar consultas" ref={filterRef}>
      {PATIENT_FILTERS.map(([key, label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span aria-label={`${counts[key]} consultas`}>{loading ? '—' : String(counts[key]).padStart(2, '0')}</span></button>)}
    </div>
    <div className="patient-list-meta"><p>Horários de Brasília</p><p role="status" aria-live="polite">{notice || (loading ? 'Buscando suas consultas…' : !error ? `${visible.length} ${visible.length === 1 ? 'consulta' : 'consultas'}` : '')}</p></div>
    <div className="patient-results" aria-busy={loading}>
      {loading ? <div className="patient-state"><span className="patient-loading-rule" aria-hidden="true" /><h2>Um instante,<br /><em>estamos buscando seus encontros.</em></h2></div> : error ? <div className="patient-state" role="alert"><h2>Não foi possível carregar<br /><em>suas consultas.</em></h2><p>{error}</p><button className="text-link" type="button" onClick={() => setRetry((value) => value + 1)}>Tentar novamente <span aria-hidden="true">↗</span></button></div> : !visible.length ? <div className="patient-state"><p className="eyebrow">{appointments.length ? 'NESTE FILTRO' : 'SEU PRÓXIMO PASSO'}</p><h2>{appointments.length ? 'Nenhuma consulta por aqui.' : <>Seu primeiro encontro<br /><em>começa com uma conversa.</em></>}</h2><p>{appointments.length ? 'Você pode escolher outro filtro para ver seus encontros.' : 'Você ainda não possui consultas agendadas.'}</p><SectionLink section="agendamento" className="text-link">Agendar uma conversa <i className="bi bi-arrow-up-right" aria-hidden="true" /></SectionLink></div> : groups.filter(([, items]) => items.length).map(([label, items]) => <section className="patient-group" key={label} aria-label={label}><h2 className="eyebrow">{label}</h2>{items.map((item) => <AppointmentItem key={item.id} appointment={item} onCancel={(appointment) => { setCancelError(''); setCancelling(appointment); }} />)}</section>)}
    </div>
    <ConfirmationModal appointment={cancelling} busy={busy} onClose={closeModal} onConfirm={confirmCancel} title={<>Cancelar<br /><em>consulta?</em></>} description={cancelling ? `Deseja cancelar seu atendimento de ${formatLongDate(cancelling.inicio)} às ${formatTime(cancelling.inicio)}? Este horário poderá ficar disponível novamente.` : ''} confirmLabel="Cancelar consulta" error={cancelError} />
  </PatientLayout>;
}
