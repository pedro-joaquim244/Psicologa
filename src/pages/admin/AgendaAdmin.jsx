import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AdminBrand from "../../components/admin/AdminBrand";
import AgendaFilters from "../../components/admin/AgendaFilters";
import AppointmentItem from "../../components/admin/AppointmentItem";
import ConfirmationModal from "../../components/admin/ConfirmationModal";
import AgendaSummary from "../../components/admin/AgendaSummary";
import AgendaAvailability from '../../components/admin/AgendaAvailability';
import { AdminToast, EmptyAgenda, ErrorAgenda, LoadingAgenda } from "../../components/admin/AdminFeedback";
import FloralMark from "../../components/Shared/FloralMark";
import { useAuth } from "../../context/AuthContext";
import { listAppointments, updateAppointmentStatus } from "../../services/api";
import { getGreetingName, isSameLocalDay, normalizeStatus, parseApiDate } from "../../utils/adminFormatters";
import "../../styles/admin.css";

const initialFilters = { status: "todos", search: "", modality: "todos" };
const actionStatus = { confirmar: "confirmado", concluir: "concluido", cancelar: "cancelado" };
const actionSuccess = { confirmar: "Agendamento confirmado com sucesso.", concluir: "Atendimento marcado como concluído.", cancelar: "Agendamento cancelado com sucesso." };

function normalizeUpdatedAppointment(response, original, action) {
  const candidate = response?.agendamento || (response?.id ? response : null);
  return { ...original, ...(candidate || {}), status: normalizeStatus(candidate?.status || actionStatus[action]) };
}

export default function AgendaAdmin() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [busy, setBusy] = useState({ id: null, action: null });
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelError, setCancelError] = useState('');
  const [toast, setToast] = useState(null);
  const [view, setView] = useState('atendimentos');
  const actionPending = useRef(false);

  const loadAgenda = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const data = await listAppointments(token, { signal });
      setAppointments([...data].sort((a, b) => (parseApiDate(a.inicio)?.getTime() || 0) - (parseApiDate(b.inicio)?.getTime() || 0)));
    } catch (requestError) {
      if (requestError.name !== "AbortError" && requestError.status !== 401) setError(requestError.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    document.title = "Agenda administrativa — Helena Martins";
    const controller = new AbortController();
    loadAgenda(controller.signal);
    return () => { document.title = "Helena Martins — Psicologia & Escuta"; controller.abort(); };
  }, [loadAgenda]);

  useEffect(() => {
    if (!toast || toast.tone === "error") return undefined;
    const timeout = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredAppointments = useMemo(() => appointments.filter((appointment) => {
    const status = normalizeStatus(appointment.status);
    const modality = String(appointment.modalidade || "").toLowerCase();
    const name = String(appointment.nome_cliente || "").toLocaleLowerCase("pt-BR");
    return (filters.status === "todos" || status === filters.status)
      && (filters.modality === "todos" || modality === filters.modality)
      && name.includes(filters.search.trim().toLocaleLowerCase("pt-BR"));
  }), [appointments, filters]);

  const summary = useMemo(() => {
    const now = new Date();
    const active = appointments.filter((appointment) => !["cancelado", "concluido"].includes(normalizeStatus(appointment.status)));
    return {
      today: active.filter((appointment) => isSameLocalDay(appointment.inicio, now)).length,
      upcoming: active.filter((appointment) => (parseApiDate(appointment.inicio)?.getTime() || 0) > now.getTime()).length,
      awaiting: appointments.filter((appointment) => normalizeStatus(appointment.status) === "agendado").length,
    };
  }, [appointments]);

  const runAction = async (appointment, action) => {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy({ id: appointment.id, action });
    setCancelError('');
    try {
      const response = await updateAppointmentStatus(appointment.id, action, token);
      const updated = normalizeUpdatedAppointment(response, appointment, action);
      setAppointments((current) => current.map((item) => item.id === appointment.id ? updated : item));
      setToast({ message: actionSuccess[action], tone: "success" });
      if (action === "cancelar") setCancelTarget(null);
    } catch (requestError) {
      if (action === 'cancelar') setCancelError(requestError.message);
      if (requestError.status !== 401 && action !== 'cancelar') setToast({ message: requestError.message, tone: "error" });
      if (requestError.status === 409) await loadAgenda();
    } finally {
      actionPending.current = false;
      setBusy({ id: null, action: null });
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/adm/login", { replace: true });
  };

  const closeCancelModal = useCallback(() => { setCancelTarget(null); setCancelError(''); }, []);

  return (
    <main className="admin-page agenda-page">
      <header className="admin-header"><div className="admin-container"><AdminBrand compact /><nav aria-label="Navegação administrativa"><Link to="/">Ver site <i className="bi bi-arrow-up-right" aria-hidden="true" /></Link><button type="button" onClick={handleLogout}>Sair <i className="bi bi-box-arrow-right" aria-hidden="true" /></button></nav></div></header>

      <div className="admin-container agenda-content">
        <section className="agenda-hero" aria-labelledby="agenda-title"><div><span className="admin-kicker">AGENDA · ÁREA RESERVADA</span><h1 id="agenda-title">Olá, {getGreetingName(user?.nome)}.</h1><p>Acompanhe e organize seus próximos atendimentos.</p></div><div className="agenda-date"><FloralMark /><span>{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date())}</span></div></section>

        <AgendaAvailability view={view} onViewChange={setView} appointments={appointments} onAppointmentsChange={loadAgenda} />
        {view === 'atendimentos' && !loading && !error && <AgendaSummary summary={summary} />}
        {view === 'atendimentos' && !loading && !error && <AgendaFilters filters={filters} onChange={setFilters} resultCount={filteredAppointments.length} />}

        {view === 'atendimentos' && <section className="appointments-section" aria-label="Lista de agendamentos">
          {loading && <LoadingAgenda />}
          {!loading && error && <ErrorAgenda message={error} onRetry={() => loadAgenda()} />}
          {!loading && !error && !filteredAppointments.length && <EmptyAgenda filtered={appointments.length > 0} onClear={() => setFilters(initialFilters)} />}
          {!loading && !error && filteredAppointments.map((appointment) => <AppointmentItem key={appointment.id} appointment={appointment} disabled={Boolean(busy.action)} busyAction={busy.id === appointment.id ? busy.action : null} onAction={runAction} onCancel={setCancelTarget} />)}
        </section>}
      </div>

      <footer className="admin-footer"><div className="admin-container"><span>HELENA MARTINS · PSICOLOGIA & ESCUTA</span><span>Sessão protegida por autenticação.</span></div></footer>
      <ConfirmationModal error={cancelError} appointment={cancelTarget} busy={busy.id === cancelTarget?.id && busy.action === "cancelar"} onClose={closeCancelModal} onConfirm={() => runAction(cancelTarget, "cancelar")} />
      <AdminToast message={toast?.message} tone={toast?.tone} onClose={() => setToast(null)} />
    </main>
  );
}
