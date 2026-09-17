import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { clinicDateKey } from '../../utils/scheduling';
import { DAY_ORDER, WEEKDAYS, previewPeriod } from '../../utils/agendaManagement';

const timeMinutes = (value) => {
  const [hour, minute] = String(value || '').slice(0, 5).split(':').map(Number);
  return Number.isInteger(hour) && Number.isInteger(minute) ? hour * 60 + minute : Number.NaN;
};

export function endAfter(start, duration) {
  const total = Math.min(timeMinutes(start) + Number(duration), 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function normalizedEnd(value, fallback) {
  const short = String(value || '').slice(0, 5);
  return short === '24:00' ? '23:59' : short || fallback;
}

const PRESETS = [
  { label: 'Manhã', start: '08:00', end: '12:00', duration: 50, interval: 10 },
  { label: 'Tarde', start: '13:00', end: '17:00', duration: 50, interval: 10 },
  { label: 'Dia todo', start: '08:00', end: '18:00', duration: 50, interval: 10 },
];

const dayList = (days) => days.length === 7
  ? 'todos os dias'
  : days.map((day) => WEEKDAYS[day].replace('-feira', '')).join(', ');

export default function ScheduleEditorModal({ editor, defaults, busy, error, onClose, onSave }) {
  const record = editor.record;
  const recurringAvailability = editor.kind === 'recorrente';
  const canChooseSeveralDays = recurringAvailability && !record && (Boolean(editor.multipleDays) || Array.isArray(editor.weekdays));
  const initialKind = recurringAvailability ? 'recorrente' : editor.kind;
  const initialScope = record?.tipo === 'recorrente' ? 'recorrente' : 'data';
  const initialDays = Array.isArray(editor.weekdays) && editor.weekdays.length
    ? [...new Set(editor.weekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    : [Number(record?.dia_semana ?? editor.weekday ?? 1)];
  const initialAllDay = Boolean(editor.allDay || record?.dia_inteiro);
  const [values, setValues] = useState(() => ({
    kind: initialKind,
    scope: initialScope,
    data: record?.data || editor.date || clinicDateKey(),
    days: initialDays.length ? initialDays : [1],
    hora_inicio: initialAllDay ? '00:00' : String(record?.hora_inicio || editor.start || '09:00').slice(0, 5),
    hora_fim: initialAllDay ? '23:59' : normalizedEnd(record?.hora_fim, editor.end || endAfter(editor.start || '09:00', recurringAvailability ? 180 : (defaults.duracao_padrao || 50))),
    duracao_minutos: Number(record?.duracao_minutos ?? defaults.duracao_padrao ?? 50),
    intervalo_minutos: Number(record?.intervalo_minutos ?? defaults.intervalo_padrao ?? 10),
    motivo: record?.motivo || '',
    dia_inteiro: initialAllDay,
    creationMode: editor.creationMode === 'unico' ? 'unico' : 'periodo',
    previous_hora_inicio: String(editor.start || (initialAllDay ? '09:00' : record?.hora_inicio) || '09:00').slice(0, 5),
    previous_hora_fim: normalizedEnd(editor.end || (initialAllDay ? '09:50' : record?.hora_fim), '09:50'),
  }));
  const [validation, setValidation] = useState('');
  const dialogRef = useRef(null);
  const initialRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const recurringBlock = values.kind === 'bloqueio' && values.scope === 'recorrente';
  const isRecurring = recurringAvailability || recurringBlock;
  const isBlock = values.kind === 'bloqueio';
  const title = recurringAvailability
    ? (record ? 'Editar período semanal' : 'Novo período semanal')
    : record ? 'Editar horário' : 'Novo horário';
  const effectiveEnd = values.creationMode === 'unico' && recurringAvailability && !record
    ? endAfter(values.hora_inicio, values.duracao_minutos)
    : values.hora_fim;
  const displayPeriodLength = timeMinutes(effectiveEnd) - timeMinutes(values.hora_inicio);
  const previewSlots = useMemo(() => recurringAvailability && !values.dia_inteiro
    ? previewPeriod({
      hora_inicio: values.hora_inicio,
      hora_fim: effectiveEnd,
      duracao_minutos: values.duracao_minutos,
      intervalo_minutos: values.creationMode === 'unico' ? 0 : values.intervalo_minutos,
    }) : [], [effectiveEnd, recurringAvailability, values.creationMode, values.dia_inteiro, values.duracao_minutos, values.hora_inicio, values.intervalo_minutos]);
  const previewDays = canChooseSeveralDays ? values.days : initialDays;

  useLayoutEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('modal-open');
    initialRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      document.body.classList.remove('modal-open');
      previous?.focus?.();
    };
  }, []);

  const update = (key, value) => {
    setValidation('');
    setValues((current) => ({ ...current, [key]: value }));
  };

  const setDays = (days) => {
    setValidation('');
    setValues((current) => ({ ...current, days }));
  };

  const toggleDay = (day) => {
    setValidation('');
    setValues((current) => ({
      ...current,
      days: current.days.includes(day) ? current.days.filter((value) => value !== day) : [...current.days, day],
    }));
  };

  const applyPreset = (preset) => {
    setValidation('');
    setValues((current) => ({
      ...current,
      creationMode: 'periodo',
      hora_inicio: preset.start,
      hora_fim: preset.end,
      duracao_minutos: preset.duration,
      intervalo_minutos: preset.interval,
    }));
  };

  const toggleAllDay = () => {
    setValidation('');
    setValues((current) => ({
      ...current,
      dia_inteiro: !current.dia_inteiro,
      hora_inicio: !current.dia_inteiro ? '00:00' : current.previous_hora_inicio,
      hora_fim: !current.dia_inteiro ? '23:59' : current.previous_hora_fim,
      previous_hora_inicio: current.dia_inteiro ? current.previous_hora_inicio : current.hora_inicio,
      previous_hora_fim: current.dia_inteiro ? current.previous_hora_fim : current.hora_fim,
    }));
  };

  const trapFocus = (event) => {
    if (event.key !== 'Tab') return;
    const dialog = dialogRef.current;
    const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.hasAttribute('hidden'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  function submit(event) {
    event.preventDefault();
    if (busy) return;

    const start = values.dia_inteiro ? '00:00' : values.hora_inicio;
    const end = values.dia_inteiro ? '23:59' : effectiveEnd;
    const periodLength = timeMinutes(end) - timeMinutes(start);
    if (!Number.isFinite(periodLength) || periodLength <= 0) {
      setValidation('O horário final precisa ser depois do horário inicial, no mesmo dia.');
      return;
    }
    if (isRecurring && !values.days.length) {
      setValidation('Selecione pelo menos um dia da semana.');
      return;
    }
    if (recurringAvailability && (!Number.isInteger(values.duracao_minutos) || values.duracao_minutos < 1 || values.duracao_minutos > periodLength)) {
      setValidation('A duração da consulta precisa caber no período informado.');
      return;
    }
    if (recurringAvailability && (!Number.isInteger(values.intervalo_minutos) || values.intervalo_minutos < 0 || values.intervalo_minutos > 1439)) {
      setValidation('Informe um intervalo entre zero e 1439 minutos.');
      return;
    }

    if (recurringAvailability) {
      const period = {
        hora_inicio: start,
        hora_fim: end,
        duracao_minutos: values.duracao_minutos,
        intervalo_minutos: values.creationMode === 'unico' ? 0 : values.intervalo_minutos,
      };
      if (canChooseSeveralDays) {
        onSave('disponibilidades/lote', null, { tipo: 'recorrente', dias_semana: values.days, periodos: [period] });
      } else {
        onSave('disponibilidades', record?.id, { tipo: 'recorrente', dia_semana: values.days[0], ...period });
      }
      return;
    }

    if (isBlock) {
      const payload = {
        tipo: values.scope,
        hora_inicio: start,
        hora_fim: end,
        motivo: values.motivo.trim(),
        ...(values.dia_inteiro ? { dia_inteiro: true } : {}),
        ...(values.scope === 'recorrente' ? { dia_semana: values.days[0] } : { data: values.data }),
      };
      onSave('bloqueios', record?.id, payload);
      return;
    }

    onSave('disponibilidades', record?.id, { tipo: 'extra', data: values.data, hora_inicio: start, hora_fim: end });
  }

  return <dialog ref={dialogRef} className="admin-modal schedule-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onKeyDown={trapFocus}>
    <p className="admin-kicker">ORGANIZAR SEUS HORÁRIOS</p>
    <h2 id={titleId}>{title}</h2>
    <p id={descriptionId} className="schedule-dialog-description">{recurringAvailability
      ? 'Monte a rotina uma vez: a prévia mostra exatamente os horários que ficarão disponíveis a cada semana.'
      : isBlock ? 'Reserve um período para você. O motivo fica visível somente na área administrativa.' : 'Abra uma consulta extra somente para a data escolhida.'}</p>
    <form className="schedule-form" onSubmit={submit} aria-busy={busy} aria-describedby={validation || error ? errorId : undefined}>
      {!recurringAvailability && <fieldset className="schedule-kind" disabled={busy || Boolean(record)}><legend>Tipo de horário</legend>
        <label><input type="radio" name="schedule-kind" value="extra" checked={values.kind === 'extra'} onChange={() => update('kind', 'extra')} /><span><i className="bi bi-plus-circle" aria-hidden="true" />Disponível</span></label>
        <label><input type="radio" name="schedule-kind" value="bloqueio" checked={values.kind === 'bloqueio'} onChange={() => update('kind', 'bloqueio')} /><span><i className="bi bi-slash-circle" aria-hidden="true" />Ocupado</span></label>
      </fieldset>}
      {isBlock && !record && <fieldset className="schedule-kind schedule-scope" disabled={busy}><legend>Aplicar bloqueio</legend>
        <label><input type="radio" name="schedule-scope" value="data" checked={values.scope === 'data'} onChange={() => update('scope', 'data')} /><span>Somente nesta data</span></label>
        <label><input type="radio" name="schedule-scope" value="recorrente" checked={values.scope === 'recorrente'} onChange={() => update('scope', 'recorrente')} /><span>Toda semana</span></label>
      </fieldset>}
      {canChooseSeveralDays ? <fieldset className="schedule-range-days" disabled={busy}><legend>Dias da semana</legend><div className="schedule-day-shortcuts"><button type="button" onClick={() => setDays([1, 2, 3, 4, 5])}>Segunda a sexta</button><button type="button" onClick={() => setDays(DAY_ORDER)}>Todos os dias</button><button type="button" onClick={() => setDays([])}>Limpar</button></div><div className="schedule-day-options">{DAY_ORDER.map((day, index) => <label key={day}><input ref={index === 0 ? initialRef : undefined} type="checkbox" checked={values.days.includes(day)} onChange={() => toggleDay(day)} />{WEEKDAYS[day]}</label>)}</div></fieldset>
        : isRecurring ? <label className="admin-field"><span>Dia da semana</span><span className="field-control"><select ref={initialRef} aria-label="Dia da semana" value={values.days[0]} onChange={(event) => update('days', [Number(event.target.value)])} disabled={busy}>{WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></span></label>
          : <label className="admin-field"><span>Data</span><span className="field-control"><input ref={initialRef} type="date" required min={record ? undefined : clinicDateKey()} value={values.data} onChange={(event) => update('data', event.target.value)} disabled={busy} /></span></label>}
      {recurringAvailability && !record && <fieldset className="schedule-kind schedule-creation-mode" disabled={busy}><legend>Como criar</legend>
        <label><input type="radio" name="schedule-creation-mode" checked={values.creationMode === 'periodo'} onChange={() => update('creationMode', 'periodo')} /><span>Por período</span></label>
        <label><input type="radio" name="schedule-creation-mode" checked={values.creationMode === 'unico'} onChange={() => update('creationMode', 'unico')} /><span>Horário específico</span></label>
      </fieldset>}
      {recurringAvailability && !record && <div className="schedule-presets"><span>Atalhos de período</span><div>{PRESETS.map((preset) => <button type="button" key={preset.label} disabled={busy} onClick={() => applyPreset(preset)}>{preset.label}<small>{preset.start}–{preset.end}</small></button>)}</div></div>}
      {isBlock && <label className="schedule-all-day"><input type="checkbox" checked={values.dia_inteiro} disabled={busy} onChange={toggleAllDay} />Bloquear o dia inteiro</label>}
      {!values.dia_inteiro && <div className="schedule-form-pair">
        <label className="admin-field"><span>Horário inicial</span><span className="field-control"><input type="time" step="60" required value={values.hora_inicio} onChange={(event) => update('hora_inicio', event.target.value)} disabled={busy} /></span></label>
        {values.creationMode !== 'unico' || !recurringAvailability || record ? <label className="admin-field"><span>Horário final</span><span className="field-control"><input type="time" step="60" required value={values.hora_fim} onChange={(event) => update('hora_fim', event.target.value)} disabled={busy} /></span></label>
          : <div className="schedule-specific-end"><span>Termina às</span><strong>{effectiveEnd}</strong><small>Uma consulta</small></div>}
      </div>}
      {recurringAvailability && <div className="schedule-form-pair">
        <label className="admin-field"><span>Duração da consulta (min)</span><span className="field-control"><input type="number" min="1" max="1439" step="1" required value={values.duracao_minutos} onChange={(event) => update('duracao_minutos', Number(event.target.value))} disabled={busy} /></span></label>
        {values.creationMode !== 'unico' || record ? <label className="admin-field"><span>Intervalo entre consultas (min)</span><span className="field-control"><input type="number" min="0" max="1439" step="1" required value={values.intervalo_minutos} onChange={(event) => update('intervalo_minutos', Number(event.target.value))} disabled={busy} /></span></label>
          : <div className="schedule-specific-end"><span>Intervalo</span><strong>—</strong><small>Horário único</small></div>}
      </div>}
      {recurringAvailability && <aside className="schedule-live-preview" aria-live="polite"><div><span className="admin-kicker">PRÉVIA SEMANAL</span><strong>Você vai criar</strong><p>{previewDays.length ? `${previewDays.length} dia${previewDays.length === 1 ? '' : 's'} (${dayList(previewDays)}) · ${previewSlots.length} horário${previewSlots.length === 1 ? '' : 's'} por dia · ${previewSlots.length * previewDays.length} no total` : 'Selecione os dias em que deseja atender.'}</p></div>{previewSlots.length > 0 && <div className="schedule-preview-slots" aria-label="Horários que serão criados">{previewSlots.map((slot) => <span key={slot.horario}>{slot.horario}–{slot.fim}</span>)}</div>}</aside>}
      {isBlock && <><label className="admin-field"><span>Motivo (opcional)</span><span className="field-control"><input type="text" maxLength="150" autoComplete="off" placeholder="Ex.: compromisso pessoal" value={values.motivo} onChange={(event) => update('motivo', event.target.value)} disabled={busy} /></span></label><small className="schedule-field-note">Visível apenas na área administrativa.</small></>}
      <p className="schedule-timezone">Horários de Brasília{values.dia_inteiro ? ' · Dia inteiro' : !recurringAvailability && values.kind === 'extra' && Number.isFinite(displayPeriodLength) && displayPeriodLength > 0 ? ` · Uma consulta de ${displayPeriodLength} minutos` : ''}</p>
      {(validation || error) && <p role="alert" id={errorId} className="schedule-error">{validation || error}</p>}
      <div className="modal-actions schedule-form-actions"><button className="admin-button secondary-button" type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="admin-button schedule-save" type="submit" disabled={busy}>{busy ? 'Salvando…' : recurringAvailability ? (record ? 'Salvar período' : 'Criar horários') : 'Salvar horário'}<i className="bi bi-arrow-up-right" aria-hidden="true" /></button></div>
    </form>
  </dialog>;
}
