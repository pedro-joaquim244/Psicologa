import { STATUS_META, formatLongDate, formatPhone, formatTimeRange, formatWeekday, normalizeStatus } from "../../utils/adminFormatters";

export default function AppointmentItem({ appointment, busyAction, disabled = false, onAction, onCancel }) {
  const status = normalizeStatus(appointment.status);
  const meta = STATUS_META[status] || { label: appointment.status || "Agendado" };
  const isBusy = disabled || Boolean(busyAction);
  const canConfirm = status === "agendado";
  const canConclude = status === "agendado" || status === "confirmado";
  const canCancel = status === "agendado" || status === "confirmado";
  const phoneHref = String(appointment.telefone_cliente || "").replace(/\D/g, "");

  return (
    <article className={`appointment-item status-${status}`} aria-busy={isBusy}>
      <div className="appointment-time">
        <span>{formatWeekday(appointment.inicio)}</span>
        <strong>{formatTimeRange(appointment.inicio, appointment.fim)}</strong>
        <time dateTime={String(appointment.inicio).replace(" ", "T")}>{formatLongDate(appointment.inicio)}</time>
      </div>

      <div className="appointment-client">
        <span className={`status-label status-${status}`}><span aria-hidden="true" />{meta.label}</span>
        <h3>{appointment.nome_cliente || "Cliente sem nome"}</h3>
        <span className="modality-label"><i className={`bi ${String(appointment.modalidade).toLowerCase() === "online" ? "bi-laptop" : "bi-door-open"}`} aria-hidden="true" /> {appointment.modalidade || "Não informada"}</span>
      </div>

      <address className="appointment-contact">
        <span><small>TELEFONE</small><a href={phoneHref ? `tel:${phoneHref}` : undefined}>{formatPhone(appointment.telefone_cliente)}</a></span>
        <span><small>E-MAIL</small><a href={appointment.email_cliente ? `mailto:${appointment.email_cliente}` : undefined}>{appointment.email_cliente || "Não informado"}</a></span>
      </address>

      <div className="appointment-actions" aria-label={`Ações para ${appointment.nome_cliente}`}>
        {canConfirm && <button type="button" className="admin-action primary-action" disabled={isBusy} onClick={() => onAction(appointment, "confirmar")}><span>{busyAction === "confirmar" ? "Confirmando…" : "Confirmar"}</span><i className="bi bi-check2" aria-hidden="true" /></button>}
        {canConclude && <button type="button" className="admin-action" disabled={isBusy} onClick={() => onAction(appointment, "concluir")}><span>{busyAction === "concluir" ? "Concluindo…" : "Concluir"}</span><i className="bi bi-arrow-up-right" aria-hidden="true" /></button>}
        {canCancel && <button type="button" className="admin-action cancel-action" disabled={isBusy} onClick={() => onCancel(appointment)}><span>Cancelar</span><i className="bi bi-x-lg" aria-hidden="true" /></button>}
        {!canConfirm && !canConclude && !canCancel && <span className="no-actions">Sem ações pendentes</span>}
      </div>
    </article>
  );
}
