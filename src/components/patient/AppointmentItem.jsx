import { useId, useState } from 'react';
import { formatLongDate, formatTimeRange, normalizeStatus } from '../../utils/adminFormatters';
import { dateStamp, patientStatus } from '../../utils/patientAppointments';

export default function AppointmentItem({ appointment, onCancel, sessionUrl }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const headingId = useId();
  const status = patientStatus(appointment);
  const stamp = dateStamp(appointment.inicio);
  const modality = appointment.modalidade === 'online' ? 'Consulta online' : 'Consulta presencial';
  // Um futuro link só será exibido se recebido explicitamente e usando HTTPS.
  const safeSessionUrl = typeof sessionUrl === 'string' && /^https:\/\//i.test(sessionUrl) ? sessionUrl : null;

  return <article className="patient-appointment" aria-labelledby={headingId} data-appointment-id={appointment.id}>
    <div className="patient-appointment-row">
      <time className="patient-date" dateTime={appointment.inicio.replace(' ', 'T')} aria-label={formatLongDate(appointment.inicio)}><span>{stamp.day}</span><span>{stamp.month}<small>{stamp.year}</small></span></time>
      <div className="patient-appointment-copy"><p className="patient-time">{formatTimeRange(appointment.inicio, appointment.fim)}</p><h3 id={headingId}>{modality}</h3></div>
      <span className={`patient-status status-${normalizeStatus(appointment.status)}`}>{status.label}</span>
      <button className="patient-details-trigger" type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)}>{expanded ? 'Fechar detalhes' : 'Ver detalhes'}<span aria-hidden="true">{expanded ? '−' : '+'}</span></button>
    </div>
    <div id={detailsId} hidden={!expanded} className="patient-appointment-details">
      <dl><div><dt>Data</dt><dd>{formatLongDate(appointment.inicio)}</dd></div><div><dt>Horário de Brasília</dt><dd>{formatTimeRange(appointment.inicio, appointment.fim)}</dd></div><div><dt>Modalidade</dt><dd>{appointment.modalidade === 'online' ? 'Online' : 'Presencial'}</dd></div><div><dt>Status</dt><dd>{status.label}</dd></div><div><dt>Solicitada em</dt><dd>{formatLongDate(appointment.criado_em)}</dd></div></dl>
      <div className="patient-detail-actions">
        {safeSessionUrl && status.category === 'marcadas' && <a className="text-link" href={safeSessionUrl} target="_blank" rel="noopener noreferrer">Acessar sessão <i className="bi bi-arrow-up-right" aria-hidden="true" /></a>}
        {appointment.status !== 'cancelado' && <button className="patient-cancel-link" type="button" onClick={() => onCancel(appointment)}>Cancelar consulta</button>}
      </div>
    </div>
  </article>;
}
