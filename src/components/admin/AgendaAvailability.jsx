import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { deleteAgendaPeriod, getAgendaAvailability, saveAgendaPeriod } from '../../services/api';
import { clinicDateKey, dateFromKey, localDateKey } from '../../utils/scheduling';
import { formatLongDate, formatPhone, formatTimeRange, normalizeStatus, STATUS_META } from '../../utils/adminFormatters';
import { DAY_ORDER, WEEKDAYS, expandPeriods, groupSlotsByPeriod } from '../../utils/agendaManagement';
import ConfirmationModal from './ConfirmationModal';
import ScheduleEditorModal from './ScheduleEditorModal';
import ScheduleBulkModal from './ScheduleBulkModal';
import ScheduleDialog from './ScheduleDialog';
import '../../styles/agenda-availability.css';

const emptySchedule = { recorrentes: [], extras: [], bloqueios: [], bloqueios_recorrentes: [], proximas_excecoes: [], horarios: [], duracao_padrao: 50, intervalo_padrao: 10 };
const shortTime = (value) => String(value || '').slice(0, 5);
const dateTime = (date, time) => `${date} ${shortTime(time)}:00`;
const overlaps = (start, end, otherStart, otherEnd) => start < otherEnd && end > otherStart;
const shortDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const isAllDayBlock = (block) => Boolean(block?.dia_inteiro || (shortTime(block?.hora_inicio) === '00:00' && shortTime(block?.hora_fim) === '24:00'));
const blockTimeLabel = (block) => isAllDayBlock(block) ? 'Dia inteiro' : `${shortTime(block?.hora_inicio)} — ${shortTime(block?.hora_fim)}`;

function PeriodActions({ onEdit, onDelete, onDuplicate }) {
  return <div className="schedule-period-actions">
    <button type="button" className="schedule-inline-button" onClick={onEdit}>Editar <i className="bi bi-pencil" aria-hidden="true" /></button>
    {onDuplicate && <button type="button" className="schedule-inline-button" onClick={onDuplicate}>Duplicar <i className="bi bi-copy" aria-hidden="true" /></button>}
    <button type="button" className="schedule-inline-button schedule-remove" onClick={onDelete}>Excluir <i className="bi bi-x" aria-hidden="true" /></button>
  </div>;
}

function WeeklySlot({ slot, day, selected, onToggle, onOpen, onEdit, onRemove }) {
  return <article className={`schedule-slot${selected ? ' is-selected' : ''}`}>
    <label className="schedule-slot-check"><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Selecionar ${slot.horario} de ${WEEKDAYS[day]}`} /></label>
    <button type="button" aria-label={`Gerenciar ${slot.horario} de ${WEEKDAYS[day]}`} onClick={onOpen}><strong>{slot.horario}</strong><span>até {slot.fim}</span></button>
    <button type="button" className="schedule-slot-edit" onClick={onEdit}>Editar</button>
    <button type="button" className="schedule-slot-remove" onClick={onRemove}>Excluir</button>
  </article>;
}

function DayTimeline({ date, schedule, appointments, onSlot, onBlock, onAppointment, onEmpty }) {
  const next = dateFromKey(date); next.setDate(next.getDate() + 1);
  const start = `${date} 00:00:00`, end = `${localDateKey(next)} 00:00:00`;
  const items = [
    ...schedule.horarios.map((slot) => ({ key: `slot-${slot.horario}`, status: 'disponivel', label: 'Disponível', title: 'Livre para agendamento', start: dateTime(date, slot.horario), end: dateTime(date, slot.fim), slot })),
    ...schedule.bloqueios.map((block) => ({ key: `block-${block.id}`, status: 'ocupado', label: block.tipo === 'recorrente' ? 'Bloqueio semanal' : 'Ocupado', title: block.motivo || 'Período reservado', start: block.inicio || dateTime(date, block.hora_inicio), end: block.fim || dateTime(date, block.hora_fim), allDay: isAllDayBlock(block), block })),
    ...appointments.filter((item) => overlaps(start, end, item.inicio, item.fim)).map((item) => ({ key: `appointment-${item.id}`, status: normalizeStatus(item.status), label: STATUS_META[normalizeStatus(item.status)]?.label || item.status, title: item.nome_cliente, start: item.inicio, end: item.fim, appointment: item })),
  ].sort((a, b) => a.start.localeCompare(b.start) || a.key.localeCompare(b.key));
  const vacant = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'].filter((time) => {
    const finish = `${String(Number(time.slice(0, 2)) + 1).padStart(2, '0')}:00`;
    return !items.some((item) => overlaps(dateTime(date, time), dateTime(date, finish), item.start, item.end));
  });
  return <section className="schedule-timeline" aria-labelledby="schedule-day-title">
    <div className="schedule-section-heading"><div><span className="admin-kicker">VISÃO DO DIA</span><h2 id="schedule-day-title">{formatLongDate(`${date} 12:00:00`)}</h2></div><span className="schedule-subtle">{schedule.horarios.length} horários disponíveis</span></div>
    {!items.length && <p className="schedule-empty">Seu dia está livre. Toque em um horário abaixo para abrir uma disponibilidade ou reservar um período.</p>}
    <ol className="schedule-timeline-list">{items.map((item) => {
      const timeLabel = item.allDay ? 'Dia inteiro' : formatTimeRange(item.start, item.end);
      const openItem = () => item.slot ? onSlot(item.slot) : item.block ? onBlock(item.block) : onAppointment(item.appointment);
      return <li key={item.key} className={`schedule-timeline-row schedule-status-${item.status}`}>
        <button type="button" className="schedule-time-button" aria-label={`${item.label} ${timeLabel}${item.appointment ? `: ${item.title}` : ''}`} onClick={openItem}><time dateTime={item.start.replace(' ', 'T')}>{timeLabel}</time><span className={`schedule-status schedule-status-${item.status}`}><span aria-hidden="true" />{item.label}</span></button>
        <div className="schedule-timeline-copy"><p>{item.title}</p>{item.appointment && <small>{item.appointment.modalidade === 'online' ? 'Atendimento online' : 'Atendimento presencial'}</small>}</div>
        <button className="schedule-inline-button" type="button" onClick={openItem}>{item.appointment ? 'Ver consulta' : 'Gerenciar'} <i className="bi bi-arrow-up-right" aria-hidden="true" /></button>
      </li>;
    })}</ol>
    {!!vacant.length && <div className="schedule-vacant"><p className="schedule-subtle">Adicionar em um horário livre</p><div>{vacant.map((time) => <button type="button" key={time} onClick={() => onEmpty(time)} aria-label={`Adicionar às ${time}`}><i className="bi bi-plus" aria-hidden="true" />{time}</button>)}</div></div>}
  </section>;
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
  const [bulk, setBulk] = useState(null);
  const [context, setContext] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeDay, setActiveDay] = useState(1);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [range, setRange] = useState(null);
  const pending = useRef(false);
  const newButton = useRef(null);
  const enabled = view !== 'atendimentos' || Boolean(editor);
  const allSlots = useMemo(() => expandPeriods([...schedule.recorrentes, ...schedule.extras]), [schedule.recorrentes, schedule.extras]);
  const weeklySlots = useMemo(() => expandPeriods(schedule.recorrentes), [schedule.recorrentes]);
  const selected = allSlots.filter((slot) => selectedKeys.includes(slot.key));
  const weeklySummary = useMemo(() => DAY_ORDER.map((day) => ({
    day,
    total: weeklySlots.filter((slot) => Number(slot.dia_semana) === day).length,
  })), [weeklySlots]);

  useEffect(() => {
    if (!enabled || !date) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    getAgendaAvailability(date, token, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) { setSchedule({ ...emptySchedule, ...data }); setSelectedKeys([]); }
    }).catch((failure) => {
      if (!controller.signal.aborted && failure.status !== 401) setError(failure.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [date, token, revision, enabled]);

  const openEditor = (kind, record, options = {}) => { setContext(null); setMutationError(''); setEditor({ kind, record, date, ...options }); };
  const closeEditor = useCallback(() => { setEditor(null); setMutationError(''); }, []);
  const closeRemove = useCallback(() => { setRemoveTarget(null); setMutationError(''); }, []);
  const closeBulk = useCallback(() => { setBulk(null); setMutationError(''); }, []);
  const askRemove = (kind, record) => { setContext(null); setMutationError(''); setRemoveTarget({ kind, record }); };
  const openBulk = (action, slots = selected, sourceDay) => { setContext(null); setMutationError(''); setBulk({ action, selected: slots, sourceDay }); };
  const changeView = (key) => { if (busy) return; onViewChange(key); setSelectedKeys([]); setNotice(''); };
  const changeDate = (offset) => { const next = dateFromKey(date); next.setDate(next.getDate() + offset); setDate(localDateKey(next)); setNotice(''); };
  const toggleSlot = (slot) => setSelectedKeys((keys) => keys.includes(slot.key) ? keys.filter((key) => key !== slot.key) : [...keys, slot.key]);
  const selectDay = (day) => {
    const keys = weeklySlots.filter((slot) => Number(slot.dia_semana) === day).map((slot) => slot.key);
    setSelectedKeys((current) => keys.every((key) => current.includes(key)) ? current.filter((key) => !keys.includes(key)) : [...new Set([...current, ...keys])]);
  };

  async function mutate(action, successView, successDate) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMutationError('');
    try {
      const result = await action();
      if (successDate) setDate(successDate);
      if (successView) onViewChange(successView);
      setEditor(null); setBulk(null); setRemoveTarget(null); setContext(null); setSelectedKeys([]);
      setNotice(result.mensagem || 'Horários atualizados com sucesso.');
      setRevision((value) => value + 1);
      onAppointmentsChange();
      requestAnimationFrame(() => newButton.current?.focus());
    } catch (failure) { if (failure.status !== 401) setMutationError(failure.message); }
    finally { pending.current = false; setBusy(false); }
  }

  function savePeriod(resource, id, payload) {
    const nextView = view === 'dia'
      ? 'dia'
      : resource.startsWith('bloqueios')
        ? 'bloqueios'
        : payload.tipo === 'recorrente' ? 'semanal' : 'extras';
    return mutate(() => saveAgendaPeriod(resource, id, payload, token), nextView, payload.data);
  }
  function saveBulk(payload) {
    const resource = bulk.action === 'copiar' ? 'disponibilidades/copiar' : 'disponibilidades/acoes';
    return mutate(() => saveAgendaPeriod(resource, null, payload, token), bulk.action === 'bloquear' ? 'bloqueios' : undefined);
  }
  function removePeriod() {
    if (removeTarget.kind === 'ocorrencia') return mutate(() => saveAgendaPeriod(`disponibilidades/${removeTarget.record.id}/ocorrencia`, null, { data: date, horario: removeTarget.record.horario }, token));
    return mutate(() => deleteAgendaPeriod(removeTarget.kind === 'bloqueio' ? 'bloqueios' : 'disponibilidades', removeTarget.record.id, token));
  }
  function openDaySlot(slot) {
    const weekday = dateFromKey(date).getDay();
    const sources = allSlots.filter((item) => item.horario === slot.horario && item.fim === slot.fim && (item.data === date || (!item.data && Number(item.dia_semana) === weekday)));
    setMutationError('');
    setContext({ kind: 'slot', slot: sources.find((item) => item.data === date) || sources[0], date, time: slot.horario });
  }
  function clone(record, kind) {
    openEditor(kind, undefined, { weekday: record.dia_semana, start: record.horario || record.hora_inicio, end: record.fim || record.hora_fim, ...(kind === 'extra' ? { date: record.data || date } : {}) });
  }
  const blockRecords = view === 'bloqueios' ? [
    ...schedule.bloqueios_recorrentes,
    ...schedule.bloqueios.filter((row) => row.tipo !== 'recorrente'),
  ] : schedule.bloqueios;
  const removalDescription = removeTarget?.kind === 'ocorrencia'
    ? `O horário das ${removeTarget.record.horario} será retirado somente de ${formatLongDate(`${date} 12:00:00`)}. A rotina das outras semanas será mantida. Se houver consulta ativa neste horário, a ação será bloqueada.`
    : removeTarget?.kind === 'bloqueio'
      ? removeTarget.record.tipo === 'recorrente' ? `O bloqueio de ${WEEKDAYS[removeTarget.record.dia_semana]} será removido de todas as próximas semanas. Os horários poderão voltar a ser reservados.` : 'Este período deixará de estar bloqueado. Os horários voltam a ser oferecidos conforme a rotina e as consultas existentes.'
      : `O período ${removeTarget?.record.hora_inicio}–${removeTarget?.record.hora_fim} deixará de ser oferecido ${removeTarget?.kind === 'recorrente' ? `em todas as próximas ${WEEKDAYS[removeTarget.record.dia_semana]}` : 'nesta data'}. As consultas já marcadas continuarão na agenda, com os mesmos dados.`;

  return <>
    <div className="schedule-toolbar"><div className="schedule-views" role="group" aria-label="Visualização da agenda">{[['atendimentos', 'Atendimentos'], ['dia', 'Horários do dia'], ['semanal', 'Rotina semanal'], ['extras', 'Extras'], ['bloqueios', 'Bloqueios']].map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} disabled={busy} onClick={() => changeView(key)}>{label}</button>)}</div><button ref={newButton} className="admin-button schedule-new" type="button" disabled={busy || (enabled && loading)} onClick={() => openEditor(view === 'bloqueios' ? 'bloqueio' : 'extra')}><i className="bi bi-plus" aria-hidden="true" /><span>Novo horário</span></button></div>
    {view !== 'atendimentos' && <div className="schedule-manager">
      <div className="schedule-manager-intro"><div><span className="admin-kicker">SUA ROTINA, DO SEU JEITO</span><h2>Gerenciar <em>horários.</em></h2><p>Organize a semana, abra uma exceção ou reserve um tempo para você.</p></div><div className="schedule-count"><strong>{weeklySlots.length}</strong><span>horários<br />por semana</span></div></div>
      <div className="schedule-quick-actions" aria-label="Atalhos de horários">
        <button type="button" disabled={busy || loading} onClick={() => openEditor('recorrente', null, { weekdays: [1, 2, 3, 4, 5], multipleDays: true })}><i className="bi bi-calendar-week" aria-hidden="true" />Adicionar horários</button>
        <button type="button" disabled={busy || loading} onClick={() => openEditor('extra')}><i className="bi bi-plus-circle" aria-hidden="true" />Horário extra</button>
        <button type="button" disabled={busy || loading} onClick={() => openEditor('bloqueio')}><i className="bi bi-slash-circle" aria-hidden="true" />Bloquear horário</button>
        <button type="button" disabled={busy || loading} onClick={() => openEditor('bloqueio', null, { allDay: true })}><i className="bi bi-calendar-x" aria-hidden="true" />Bloquear dia inteiro</button>
      </div>
      {view !== 'semanal' && <div className="schedule-day-controls"><label className="admin-field"><span>Dia da agenda</span><span className="field-control"><input type="date" required value={date} disabled={busy} onChange={(event) => { if (event.target.value) { setDate(event.target.value); setNotice(''); } }} /></span></label><div className="schedule-day-navigation"><button className="admin-button secondary-button" type="button" disabled={busy} onClick={() => changeDate(-1)} aria-label="Dia anterior"><i className="bi bi-arrow-left" aria-hidden="true" /></button><button className="admin-button secondary-button" type="button" disabled={busy} onClick={() => setDate(clinicDateKey())}>Hoje</button><button className="admin-button secondary-button" type="button" disabled={busy} onClick={() => changeDate(1)} aria-label="Próximo dia"><i className="bi bi-arrow-right" aria-hidden="true" /></button></div><span className="schedule-timezone">Horários de Brasília</span></div>}
      <p className="schedule-feedback" role="status" aria-live="polite">{notice || (loading ? 'Buscando os horários da agenda…' : '')}</p>
      {loading ? <div className="schedule-empty" aria-busy="true">Carregando disponibilidade…</div> : error ? <div className="schedule-error-state" role="alert"><p>{error}</p><button type="button" className="admin-button secondary-button" onClick={() => setRevision((value) => value + 1)}>Tentar novamente</button></div> : <>
        {view === 'semanal' && <>
          <div className="schedule-section-heading"><div><span className="admin-kicker">HORÁRIOS RECORRENTES</span><h3>Uma semana bem organizada.</h3><p className="schedule-subtle">Toque no horário para editar. Selecione vários para uma ação em conjunto.</p></div><button className="admin-button secondary-button" type="button" onClick={() => openEditor('recorrente')}>Adicionar período <i className="bi bi-plus" aria-hidden="true" /></button></div>
          <div className="schedule-week-tools"><button type="button" className="schedule-inline-button" onClick={() => setRange({ start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] })}>Selecionar por horário <i className="bi bi-check2-square" aria-hidden="true" /></button><button type="button" className="schedule-inline-button" onClick={() => setSelectedKeys(weeklySlots.map((slot) => slot.key))}>Selecionar toda a semana</button></div>
          <section className="schedule-week-summary" aria-label="Resumo dos horários da semana">{weeklySummary.map(({ day, total }) => <div key={day}><span>{shortDays[day]}</span><strong>{total}</strong><small>{total === 1 ? 'horário' : 'horários'}</small></div>)}<div className="schedule-week-summary-total"><span>Total</span><strong>{weeklySlots.length}</strong><small>por semana</small></div></section>
          <div className="schedule-status-legend" aria-label="Legenda da agenda"><span className="schedule-status schedule-status-disponivel"><i aria-hidden="true" />Disponível</span><span className="schedule-status schedule-status-confirmado"><i aria-hidden="true" />Agendado</span><span className="schedule-status schedule-status-ocupado"><i aria-hidden="true" />Bloqueado</span><span className="schedule-status schedule-status-extra"><i aria-hidden="true" />Extra</span></div>
          <div className="schedule-mobile-days" role="group" aria-label="Dia da semana em exibição">{DAY_ORDER.map((day) => <button key={day} type="button" aria-label={WEEKDAYS[day]} aria-pressed={activeDay === day} onClick={() => setActiveDay(day)}><span>{shortDays[day]}</span><small>{weeklySlots.filter((slot) => Number(slot.dia_semana) === day).length}</small></button>)}</div>
          <section className="schedule-week" aria-label="Períodos da semana">{DAY_ORDER.map((day) => {
            const slots = weeklySlots.filter((slot) => Number(slot.dia_semana) === day);
            const slotGroups = groupSlotsByPeriod(slots);
            const blocks = schedule.bloqueios_recorrentes.filter((block) => Number(block.dia_semana) === day);
            return <section key={day} className={`schedule-weekday${activeDay === day ? ' is-active-day' : ''}`} aria-labelledby={`schedule-weekday-${day}`}>
              <div className="schedule-weekday-heading"><div><span className="admin-kicker">{String(DAY_ORDER.indexOf(day) + 1).padStart(2, '0')}</span><h3 id={`schedule-weekday-${day}`}>{WEEKDAYS[day]}</h3><small>{slots.length} {slots.length === 1 ? 'horário disponível' : 'horários disponíveis'}</small></div><button type="button" className="schedule-inline-button" onClick={() => openEditor('recorrente', null, { weekday: day })} aria-label={`Adicionar horário toda ${WEEKDAYS[day]}`}><i className="bi bi-plus" aria-hidden="true" /></button></div>
              {!!slots.length && <label className="schedule-select-day"><input type="checkbox" checked={slots.every((slot) => selectedKeys.includes(slot.key))} onChange={() => selectDay(day)} />Selecionar {WEEKDAYS[day]}</label>}
              {!slots.length ? <div className="schedule-day-empty"><i className="bi bi-sun" aria-hidden="true" /><p>Nenhum horário configurado.</p><button type="button" onClick={() => openEditor('recorrente', null, { weekday: day })}>Adicionar horário</button></div> : <div className="schedule-slot-groups">{slotGroups.map((group) => <section className="schedule-slot-period" key={group.key}><div><h4>{group.label}</h4><span>{group.slots.length} {group.slots.length === 1 ? 'horário' : 'horários'}</span></div><div className="schedule-slot-grid">{group.slots.map((slot) => <WeeklySlot key={slot.key} slot={slot} day={day} selected={selectedKeys.includes(slot.key)} onToggle={() => toggleSlot(slot)} onOpen={() => setContext({ kind: 'slot', slot })} onEdit={() => openEditor('recorrente', schedule.recorrentes.find((record) => record.id === slot.id) || slot)} onRemove={() => askRemove('recorrente', schedule.recorrentes.find((record) => record.id === slot.id) || slot)} />)}</div></section>)}</div>}
              {!!blocks.length && <div className="schedule-week-blocks">{blocks.map((block) => <button type="button" key={block.id} onClick={() => openEditor('bloqueio', block)}><i className="bi bi-slash-circle" aria-hidden="true" />{blockTimeLabel(block)}<span>Ocupado</span></button>)}</div>}
              {!!slots.length && <div className="schedule-day-footer"><button className="schedule-inline-button" type="button" aria-label={`Copiar horários de ${WEEKDAYS[day]}`} onClick={() => openBulk('copiar', slots, day)}>Copiar horários <i className="bi bi-copy" aria-hidden="true" /></button><button type="button" className="schedule-inline-button schedule-remove" aria-label={`Limpar horários de ${WEEKDAYS[day]}`} onClick={() => openBulk('remover', slots)}>Limpar dia</button></div>}
            </section>;
          })}</section>
          {!!schedule.proximas_excecoes?.length && <section className="schedule-upcoming-exceptions" aria-labelledby="upcoming-exceptions-title"><div><span className="admin-kicker">PRÓXIMAS EXCEÇÕES</span><h3 id="upcoming-exceptions-title">O que foge da rotina</h3></div><div>{schedule.proximas_excecoes.map((item) => <button type="button" key={`${item.tipo}-${item.id}`} onClick={() => openEditor(item.tipo === 'bloqueio' ? 'bloqueio' : 'extra', item)}><span className={`schedule-status schedule-status-${item.tipo === 'bloqueio' ? 'ocupado' : 'extra'}`}><i aria-hidden="true" />{item.tipo === 'bloqueio' ? 'Bloqueado' : 'Extra'}</span><strong>{formatLongDate(`${item.data} 12:00:00`)}</strong><small>{item.hora_inicio} — {item.hora_fim}{item.motivo ? ` · ${item.motivo}` : ''}</small></button>)}</div></section>}
        </>}
        {view === 'dia' && <DayTimeline date={date} schedule={schedule} appointments={appointments.filter((item) => !item.profissional_id || item.profissional_id === schedule.profissional_id)} onSlot={openDaySlot} onBlock={(block) => setContext({ kind: 'bloqueio', record: block })} onAppointment={(appointment) => setContext({ kind: 'consulta', appointment })} onEmpty={(time) => setContext({ kind: 'vazio', time })} />}
        {(view === 'dia' || view === 'extras') && <section className="schedule-day-changes" aria-labelledby="schedule-changes-title">
          <div className="schedule-section-heading"><div><span className="admin-kicker">SOMENTE NESTA DATA</span><h3 id="schedule-changes-title">{view === 'dia' ? 'Alterações deste dia' : 'Horários extras'}</h3><p className="schedule-subtle">Estas disponibilidades não se repetem nas próximas semanas.</p></div></div>
          {!schedule.extras.length && !(view === 'dia' && schedule.bloqueios.length) && <p className="schedule-empty">Nenhum horário extra ou bloqueio nesta data.</p>}
          <div className="schedule-manual-list">
            {schedule.extras.map((record) => <article className="schedule-period" key={`extra-${record.id}`}><div><span className="schedule-status schedule-status-disponivel">Horário extra</span><h3>{record.hora_inicio} — {record.hora_fim}</h3><p>{formatLongDate(`${record.data || date} 12:00:00`)}</p>{view === 'extras' && <label className="schedule-select-day"><input type="checkbox" checked={selectedKeys.includes(`${record.id}-${record.hora_inicio}`)} onChange={() => toggleSlot({ key: `${record.id}-${record.hora_inicio}` })} aria-label={`Selecionar extra ${record.hora_inicio}`} />Selecionar</label>}</div><PeriodActions onEdit={() => openEditor('extra', record)} onDuplicate={() => clone(record, 'extra')} onDelete={() => askRemove('extra', record)} /></article>)}
            {view === 'dia' && schedule.bloqueios.map((record) => <article className="schedule-period schedule-period-bloqueio" key={`block-${record.id}`}><div><span className="schedule-status schedule-status-ocupado">{record.tipo === 'recorrente' ? `Toda ${WEEKDAYS[record.dia_semana]}` : 'Ocupado'}</span><h3>{record.dia_inteiro ? 'Dia inteiro' : `${record.hora_inicio} — ${record.hora_fim}`}</h3><p>{record.motivo || 'Período reservado para você.'}</p></div><PeriodActions onEdit={() => openEditor('bloqueio', record)} onDelete={() => askRemove('bloqueio', record)} /></article>)}
          </div>
        </section>}
        {view === 'bloqueios' && <section className="schedule-day-changes" aria-label="Bloqueios da agenda"><div className="schedule-section-heading"><div><span className="admin-kicker">TEMPO RESERVADO PARA VOCÊ</span><h3>Horários ocupados</h3><p className="schedule-subtle">Bloqueios semanais e desta data. O motivo fica apenas na área administrativa.</p></div></div>{!blockRecords.length && <p className="schedule-empty">Nenhum bloqueio cadastrado para esta seleção.</p>}<div className="schedule-manual-list">{blockRecords.map((record) => <article className="schedule-period schedule-period-bloqueio" key={record.id}><div><span className="schedule-status schedule-status-ocupado">{record.tipo === 'recorrente' ? `Toda ${WEEKDAYS[record.dia_semana]}` : 'Somente nesta data'}</span><h3>{record.dia_inteiro || (record.hora_inicio === '00:00' && record.hora_fim === '24:00') ? 'Dia inteiro' : `${record.hora_inicio} — ${record.hora_fim}`}</h3><p>{record.motivo || 'Período reservado para você.'}</p></div><PeriodActions onEdit={() => openEditor('bloqueio', record)} onDelete={() => askRemove('bloqueio', record)} /></article>)}</div></section>}
      </>}
      {!!selected.length && <aside className="schedule-selection-bar" aria-label="Ações nos horários selecionados"><div><strong>{selected.length} selecionado{selected.length === 1 ? '' : 's'}</strong><button type="button" onClick={() => setSelectedKeys([])}>Limpar seleção</button></div><div className="schedule-selection-actions"><button type="button" disabled={busy} onClick={() => openBulk('remover')}>Remover selecionados</button>{view === 'semanal' && <><button type="button" disabled={busy} onClick={() => openBulk('duracao')}>Alterar duração</button><button type="button" disabled={busy} onClick={() => openBulk('bloquear')}>Bloquear selecionados</button><button type="button" disabled={busy} onClick={() => openBulk('duplicar')}>Duplicar para outros dias</button></>}</div></aside>}
    </div>}
    {editor && <ScheduleEditorModal key={`${editor.kind}-${editor.record?.id || 'new'}`} editor={editor} defaults={schedule} busy={busy} error={mutationError} onClose={closeEditor} onSave={savePeriod} />}
    {bulk && <ScheduleBulkModal {...bulk} defaults={schedule} busy={busy} error={mutationError} onClose={closeBulk} onSave={saveBulk} />}
    {context && <ScheduleDialog title={context.kind === 'consulta' ? context.appointment.nome_cliente : context.kind === 'bloqueio' ? 'Gerenciar bloqueio' : `Horário das ${context.slot?.horario || context.time}`} description={context.kind === 'consulta' ? formatLongDate(context.appointment.inicio) : context.date ? `Somente em ${formatLongDate(`${context.date} 12:00:00`)} ou em todas as próximas semanas: escolha o alcance da ação.` : context.slot ? `Este horário se repete em ${WEEKDAYS[context.slot.dia_semana]}.` : 'Escolha como deseja organizar este período.'} busy={busy} onClose={() => setContext(null)}>
      {context.kind === 'consulta' ? <div className="schedule-appointment-detail"><span className="schedule-status">{STATUS_META[normalizeStatus(context.appointment.status)]?.label}</span><strong>{formatTimeRange(context.appointment.inicio, context.appointment.fim)}</strong><p>{context.appointment.modalidade === 'online' ? 'Consulta online' : 'Consulta presencial'}</p><dl><dt>E-mail</dt><dd>{context.appointment.email_cliente || 'Não informado'}</dd><dt>Telefone</dt><dd>{formatPhone(context.appointment.telefone_cliente)}</dd></dl><button type="button" className="admin-button secondary-button" onClick={() => setContext(null)}>Fechar detalhes</button></div> : <div className="schedule-context-actions">
        {context.kind === 'bloqueio' ? <><button type="button" onClick={() => openEditor('bloqueio', context.record)}>Editar bloqueio</button><button type="button" className="schedule-remove" onClick={() => askRemove('bloqueio', context.record)}>Remover bloqueio</button></> : context.slot ? <>
          <button type="button" onClick={() => openEditor(context.slot.data ? 'extra' : 'recorrente', schedule.recorrentes.find((row) => row.id === context.slot.id) || schedule.extras.find((row) => row.id === context.slot.id))}>Editar período <small>Ajustar início, fim, duração e intervalo.</small></button>
          <button type="button" onClick={() => clone(context.slot, context.slot.data ? 'extra' : 'recorrente')}>Duplicar horário <small>Use este horário como ponto de partida.</small></button>
          {context.slot.data
            ? <button type="button" className="schedule-remove" onClick={() => askRemove('extra', context.slot)}>Excluir horário extra <small>Remover somente de {formatLongDate(`${context.slot.data} 12:00:00`)}</small></button>
            : context.date && <button type="button" className="schedule-remove" onClick={() => askRemove('ocorrencia', context.slot)}>Remover somente deste dia <small>{formatLongDate(`${date} 12:00:00`)}</small></button>}
          {!context.slot.data && <button type="button" className="schedule-remove" onClick={() => openBulk('remover', [context.slot])}>Remover recorrência <small>Retirar {context.slot.horario} de todas as próximas {WEEKDAYS[context.slot.dia_semana]}.</small></button>}
          {context.date && <button type="button" onClick={() => openEditor('bloqueio', null, { start: context.slot.horario, end: context.slot.fim })}>Bloquear horário</button>}
        </> : <><button type="button" onClick={() => openEditor('extra', null, { start: context.time })}>Criar disponibilidade</button><button type="button" onClick={() => openEditor('bloqueio', null, { start: context.time })}>Bloquear horário</button></>}
      </div>}
    </ScheduleDialog>}
    {range && <ScheduleDialog title="Selecionar por horário" description="Escolha os dias e o período. Depois aplique uma ação a todos os horários encontrados." onClose={() => setRange(null)}><form className="schedule-form" onSubmit={(event) => { event.preventDefault(); setSelectedKeys(weeklySlots.filter((slot) => range.days.includes(Number(slot.dia_semana)) && overlaps(slot.horario, slot.fim, range.start, range.end)).map((slot) => slot.key)); setRange(null); }}><fieldset className="schedule-range-days"><legend>Dias para selecionar</legend>{DAY_ORDER.map((day) => <label key={day}><input type="checkbox" checked={range.days.includes(day)} onChange={() => setRange((value) => ({ ...value, days: value.days.includes(day) ? value.days.filter((item) => item !== day) : [...value.days, day] }))} />{shortDays[day]}</label>)}</fieldset><div className="schedule-form-pair"><label className="admin-field"><span>A partir de</span><input type="time" value={range.start} required onChange={(event) => setRange({ ...range, start: event.target.value })} /></label><label className="admin-field"><span>Até</span><input type="time" value={range.end} required onChange={(event) => setRange({ ...range, end: event.target.value })} /></label></div><button type="submit" className="admin-button" disabled={!range.days.length || range.start >= range.end}>Selecionar horários</button></form></ScheduleDialog>}
    <ConfirmationModal appointment={removeTarget} busy={busy} onClose={closeRemove} onConfirm={removePeriod} title={removeTarget?.kind === 'bloqueio' ? 'Excluir bloqueio?' : removeTarget?.kind === 'ocorrencia' ? 'Remover somente deste dia?' : 'Excluir horário?'} description={removalDescription} confirmLabel={removeTarget?.kind === 'ocorrencia' ? 'Remover deste dia' : 'Excluir'} busyLabel="Removendo…" kicker="CONFIRMAR ALTERAÇÃO" error={mutationError} />
  </>;
}
