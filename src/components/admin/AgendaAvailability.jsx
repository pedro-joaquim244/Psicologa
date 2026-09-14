import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { deleteAgendaPeriod, getAgendaAvailability, saveAgendaPeriod } from '../../services/api';
import { clinicDateKey, dateFromKey, localDateKey } from '../../utils/scheduling';
import { formatLongDate, formatTimeRange, normalizeStatus, STATUS_META } from '../../utils/adminFormatters';
import ConfirmationModal from './ConfirmationModal';
import ScheduleEditorModal, { WEEKDAYS } from './ScheduleEditorModal';
import '../../styles/agenda-availability.css';

const emptySchedule = { recorrentes: [], extras: [], bloqueios: [], horarios: [], duracao_padrao: 50, intervalo_padrao: 10 };
const shortTime = (value) => String(value || '').slice(0, 5);
const dateTime = (date, time) => `${date} ${shortTime(time)}:00`;
const overlaps = (start, end, otherStart, otherEnd) => start < otherEnd && end > otherStart;
const dayKeys = [1, 2, 3, 4, 5, 6, 0];

function DayTimeline({ date, schedule, appointments, onBlock }) {
  const nextDay = dateFromKey(date); nextDay.setDate(nextDay.getDate() + 1);
  const start = `${date} 00:00:00`;
  const end = `${localDateKey(nextDay)} 00:00:00`;
  const items = [
    ...schedule.horarios.map((slot) => ({ key: `slot-${slot.horario}`, status: 'disponivel', label: 'Disponível', title: 'Livre para agendamento', start: dateTime(date, slot.horario), end: dateTime(date, slot.fim), slot })),
    ...schedule.bloqueios.map((block) => ({ key: `block-${block.id}`, status: 'ocupado', label: 'Ocupado', title: block.motivo || 'Período reservado', start: block.inicio || dateTime(date, block.hora_inicio), end: block.fim || dateTime(date, block.hora_fim) })),
    ...appointments.filter((item) => overlaps(start, end, item.inicio, item.fim)).map((item) => ({ key: `appointment-${item.id}`, status: normalizeStatus(item.status), label: STATUS_META[normalizeStatus(item.status)]?.label || item.status, title: item.nome_cliente, start: item.inicio, end: item.fim, modality: item.modalidade })),
  ].sort((a, b) => a.start.localeCompare(b.start) || a.key.localeCompare(b.key));

  return <section className="schedule-timeline" aria-labelledby="schedule-day-title">
    <div className="schedule-section-heading"><div><span className="admin-kicker">VISÃO DO DIA</span><h2 id="schedule-day-title">{formatLongDate(`${date} 12:00:00`)}</h2></div><span className="schedule-subtle">{schedule.horarios.length} {schedule.horarios.length === 1 ? 'horário disponível' : 'horários disponíveis'}</span></div>
    {!items.length ? <p className="schedule-empty">Nenhum horário para esta data. Você pode abrir uma consulta extra ou adicionar um período à rotina semanal.</p> : <ol className="schedule-timeline-list">{items.map((item) => <li key={item.key} className={`schedule-timeline-row schedule-status-${item.status}`}>
      <time dateTime={item.start.replace(' ', 'T')}>{formatTimeRange(item.start, item.end)}</time>
      <span className={`schedule-status schedule-status-${item.status}`}><span aria-hidden="true" />{item.label}</span>
      <div className="schedule-timeline-copy"><p>{item.title}</p>{item.modality && <small>{item.modality === 'online' ? 'Atendimento online' : 'Atendimento presencial'}</small>}</div>
      {item.slot && <button className="schedule-inline-button" type="button" onClick={() => onBlock(item.slot)} aria-label={`Bloquear horário ${item.slot.horario}`}>Marcar ocupado <i className="bi bi-plus" aria-hidden="true" /></button>}
    </li>)}</ol>}
  </section>;
}

function PeriodActions({ onEdit, onDelete }) {
  return <div className="schedule-period-actions"><button type="button" className="schedule-inline-button" onClick={onEdit}>Editar <i className="bi bi-pencil" aria-hidden="true" /></button><button type="button" className="schedule-inline-button schedule-remove" onClick={onDelete}>Excluir <i className="bi bi-x" aria-hidden="true" /></button></div>;
}

export default function AgendaAvailability({ view, onViewChange, appointments, onAppointmentsChange }) {
  const { token } = useAuth();
  const [date, setDate] = useState(clinicDateKey);
  const [schedule, setSchedule] = useState(emptySchedule);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef(false);
  const newButton = useRef(null);
  const enabled = view !== 'atendimentos' || Boolean(editor);

  useEffect(() => {
    if (!enabled || !date) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    getAgendaAvailability(date, token, { signal: controller.signal }).then((data) => { if (!controller.signal.aborted) setSchedule(data); }).catch((failure) => {
      if (!controller.signal.aborted && failure.status !== 401) setError(failure.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [date, token, revision, enabled]);

  const openEditor = (kind, record, options = {}) => { setMutationError(''); setEditor({ kind, record, date, ...options }); };
  const closeEditor = useCallback(() => { setEditor(null); setMutationError(''); }, []);
  const closeRemove = useCallback(() => { setRemoveTarget(null); setMutationError(''); }, []);
  const askRemove = (kind, record) => { setMutationError(''); setRemoveTarget({ kind, record }); };
  const changeDate = (offset) => { const next = dateFromKey(date); next.setDate(next.getDate() + offset); setDate(localDateKey(next)); setNotice(''); };

  async function savePeriod(resource, id, payload) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMutationError('');
    try {
      await saveAgendaPeriod(resource, id, payload, token);
      if (payload.data) setDate(payload.data);
      onViewChange(payload.tipo === 'recorrente' ? 'semanal' : 'dia');
      setEditor(null);
      setNotice(id ? 'Horário atualizado. A disponibilidade já foi ajustada.' : 'Horário salvo. A disponibilidade já foi ajustada.');
      setRevision((value) => value + 1);
      onAppointmentsChange();
      requestAnimationFrame(() => newButton.current?.focus());
    } catch (failure) { if (failure.status !== 401) setMutationError(failure.message); }
    finally { pending.current = false; setBusy(false); }
  }

  async function removePeriod() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMutationError('');
    try {
      await deleteAgendaPeriod(removeTarget.kind === 'bloqueio' ? 'bloqueios' : 'disponibilidades', removeTarget.record.id, token);
      setNotice(removeTarget.kind === 'bloqueio' ? 'Bloqueio excluído. Os horários foram atualizados.' : 'Horário excluído. A disponibilidade foi atualizada.');
      setRemoveTarget(null); setRevision((value) => value + 1);
      onAppointmentsChange();
      requestAnimationFrame(() => newButton.current?.focus());
    } catch (failure) { if (failure.status !== 401) setMutationError(failure.message); }
    finally { pending.current = false; setBusy(false); }
  }

  const manualPeriods = useMemo(() => [
    ...schedule.extras.map((record) => ({ kind: 'extra', record })),
    ...schedule.bloqueios.map((record) => ({ kind: 'bloqueio', record })),
  ].sort((a, b) => a.record.hora_inicio.localeCompare(b.record.hora_inicio)), [schedule]);

  return <>
    <div className="schedule-toolbar"><div className="schedule-views" role="group" aria-label="Visualização da agenda">{[['atendimentos', 'Atendimentos'], ['dia', 'Horários do dia'], ['semanal', 'Rotina semanal']].map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => { onViewChange(key); setNotice(''); }}>{label}</button>)}</div><button ref={newButton} className="admin-button schedule-new" type="button" onClick={() => openEditor('extra')}><i className="bi bi-plus" aria-hidden="true" /><span>Novo horário</span></button></div>
    {view !== 'atendimentos' && <div className="schedule-manager">
      <div className="schedule-manager-intro"><div><span className="admin-kicker">{view === 'semanal' ? 'HORÁRIOS RECORRENTES' : 'ALTERAÇÕES DE UM DIA ESPECÍFICO'}</span><p>{view === 'semanal' ? 'Organize seus períodos de atendimento. Eles se repetem a cada semana.' : 'Abra horários extras, reserve períodos ocupados e acompanhe os encontros desta data.'}</p></div>{view === 'semanal' && <button className="admin-button secondary-button" type="button" onClick={() => openEditor('recorrente')}>Adicionar período <i className="bi bi-plus" aria-hidden="true" /></button>}</div>
      {view === 'dia' && <div className="schedule-day-controls"><label className="admin-field"><span>Dia da agenda</span><span className="field-control"><input type="date" required value={date} onChange={(event) => { if (event.target.value) { setDate(event.target.value); setNotice(''); } }} /></span></label><div className="schedule-day-navigation"><button className="admin-button secondary-button" type="button" onClick={() => changeDate(-1)} aria-label="Dia anterior"><i className="bi bi-arrow-left" aria-hidden="true" /></button><button className="admin-button secondary-button" type="button" onClick={() => { setDate(clinicDateKey()); setRevision((value) => value + 1); }}>Hoje</button><button className="admin-button secondary-button" type="button" onClick={() => changeDate(1)} aria-label="Próximo dia"><i className="bi bi-arrow-right" aria-hidden="true" /></button></div><span className="schedule-timezone">Horários de Brasília</span></div>}
      <p className="schedule-feedback" role="status" aria-live="polite">{notice || (loading ? 'Buscando os horários da agenda…' : '')}</p>
      {loading ? <div className="schedule-empty" aria-busy="true">Carregando disponibilidade…</div> : error ? <div className="schedule-error-state" role="alert"><p>{error}</p><button type="button" className="admin-button secondary-button" onClick={() => setRevision((value) => value + 1)}>Tentar novamente</button></div> : view === 'semanal' ? <section className="schedule-week" aria-label="Períodos da semana">{dayKeys.map((day) => {
        const periods = schedule.recorrentes.filter((record) => Number(record.dia_semana) === day).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
        return <section key={day} className="schedule-weekday" aria-labelledby={`schedule-weekday-${day}`}><div className="schedule-weekday-heading"><h2 id={`schedule-weekday-${day}`}>{WEEKDAYS[day]}</h2><button type="button" className="schedule-inline-button" onClick={() => openEditor('recorrente', null, { weekday: day })} aria-label={`Adicionar período em ${WEEKDAYS[day]}`}><i className="bi bi-plus" aria-hidden="true" /></button></div>{!periods.length ? <p className="schedule-subtle">Sem períodos cadastrados.</p> : periods.map((record) => <article className="schedule-week-period" key={record.id}><p className="schedule-period-time">{shortTime(record.hora_inicio)} — {shortTime(record.hora_fim)}</p><p className="schedule-subtle">Consultas de {record.duracao_minutos} min · Intervalo de {record.intervalo_minutos} min</p><PeriodActions onEdit={() => openEditor('recorrente', record)} onDelete={() => askRemove('recorrente', record)} /></article>)}</section>;
      })}</section> : <>
        <DayTimeline date={date} schedule={schedule} appointments={appointments} onBlock={(slot) => openEditor('bloqueio', null, { start: slot.horario, end: slot.fim })} />
        <section className="schedule-day-changes" aria-labelledby="schedule-changes-title"><div className="schedule-section-heading"><div><span className="admin-kicker">AJUSTES MANUAIS</span><h2 id="schedule-changes-title">Alterações deste dia</h2></div></div>{!manualPeriods.length ? <p className="schedule-empty">Nenhum horário extra ou bloqueio nesta data.</p> : <div className="schedule-manual-list">{manualPeriods.map(({ kind, record }) => <article className={`schedule-period schedule-period-${kind}`} key={`${kind}-${record.id}`}><div><span className={`schedule-status schedule-status-${kind === 'bloqueio' ? 'ocupado' : 'disponivel'}`}><span aria-hidden="true" />{kind === 'bloqueio' ? 'Ocupado' : 'Horário extra'}</span><h3>{shortTime(record.hora_inicio)} — {shortTime(record.hora_fim)}</h3><p>{kind === 'bloqueio' ? record.motivo || 'Período reservado para você.' : 'Uma consulta nesta data.'}</p></div><PeriodActions onEdit={() => openEditor(kind, record)} onDelete={() => askRemove(kind, record)} /></article>)}</div>}</section>
      </>}
    </div>}
    {editor && <ScheduleEditorModal key={`${editor.kind}-${editor.record?.id || 'new'}`} editor={editor} defaults={schedule} busy={busy} error={mutationError} onClose={closeEditor} onSave={savePeriod} />}
    <ConfirmationModal appointment={removeTarget} busy={busy} onClose={closeRemove} onConfirm={removePeriod} title={removeTarget?.kind === 'bloqueio' ? 'Excluir bloqueio?' : 'Excluir horário?'} description={removeTarget?.kind === 'bloqueio' ? 'Este período deixará de estar bloqueado. Os horários voltam a ser oferecidos conforme a rotina e as consultas existentes.' : removeTarget?.kind === 'recorrente' ? 'Este período deixará de ser oferecido nas próximas semanas. Consultas existentes não serão canceladas.' : 'Este horário extra deixará de ser oferecido para esta data. Consultas existentes não serão canceladas.'} confirmLabel="Excluir" busyLabel="Excluindo…" kicker="ORGANIZAR SEUS HORÁRIOS" error={mutationError} />
  </>;
}
