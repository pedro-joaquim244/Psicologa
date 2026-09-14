import { useId, useLayoutEffect, useRef, useState } from 'react';
import { clinicDateKey } from '../../utils/scheduling';

export const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const timeMinutes = (value) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; };
export function endAfter(start, duration) {
  const total = Math.min(timeMinutes(start) + Number(duration), 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export default function ScheduleEditorModal({ editor, defaults, busy, error, onClose, onSave }) {
  const weekly = editor.kind === 'recorrente';
  const initialDuration = defaults.duracao_padrao || 50;
  const record = editor.record;
  const [values, setValues] = useState(() => ({
    kind: editor.kind,
    data: record?.data || editor.date,
    dia_semana: record?.dia_semana ?? editor.weekday ?? 1,
    hora_inicio: String(record?.hora_inicio || editor.start || '09:00').slice(0, 5),
    hora_fim: String(record?.hora_fim || editor.end || endAfter(editor.start || '09:00', weekly ? 180 : initialDuration)).slice(0, 5),
    duracao_minutos: record?.duracao_minutos ?? initialDuration,
    intervalo_minutos: record?.intervalo_minutos ?? defaults.intervalo_padrao ?? 10,
    motivo: record?.motivo || '',
  }));
  const [validation, setValidation] = useState('');
  const dialogRef = useRef(null);
  const initialRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const title = weekly ? (record ? 'Editar período semanal' : 'Novo período semanal') : (record ? 'Editar horário' : 'Novo horário');

  useLayoutEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    document.body.classList.add('modal-open');
    initialRef.current?.focus();
    return () => {
      dialog.close();
      document.body.classList.remove('modal-open');
      previous?.focus?.();
    };
  }, []);

  const update = (key, value) => { setValidation(''); setValues((current) => ({ ...current, [key]: value })); };
  function submit(event) {
    event.preventDefault();
    if (busy) return;
    const duration = timeMinutes(values.hora_fim) - timeMinutes(values.hora_inicio);
    if (!Number.isFinite(duration) || duration <= 0) return setValidation('O horário final precisa ser depois do horário inicial, no mesmo dia.');
    if (weekly && (!Number.isInteger(Number(values.duracao_minutos)) || Number(values.duracao_minutos) < 1 || Number(values.duracao_minutos) > duration)) {
      return setValidation('A duração da consulta precisa caber no período informado.');
    }
    if (weekly && (!Number.isInteger(Number(values.intervalo_minutos)) || Number(values.intervalo_minutos) < 0)) {
      return setValidation('Informe um intervalo de zero minutos ou mais.');
    }
    const payload = {
      hora_inicio: values.hora_inicio,
      hora_fim: values.hora_fim,
      ...(weekly ? { tipo: 'recorrente', dia_semana: Number(values.dia_semana), duracao_minutos: Number(values.duracao_minutos), intervalo_minutos: Number(values.intervalo_minutos) }
        : values.kind === 'bloqueio' ? { data: values.data, motivo: values.motivo.trim() }
          : { tipo: 'extra', data: values.data }),
    };
    onSave(values.kind === 'bloqueio' ? 'bloqueios' : 'disponibilidades', record?.id, payload);
  }

  return <dialog ref={dialogRef} className="admin-modal schedule-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <p className="admin-kicker">ORGANIZAR SEUS HORÁRIOS</p>
    <h2 id={titleId}>{title}</h2>
    <p id={descriptionId} className="schedule-dialog-description">{weekly ? 'Este período se repete toda semana. A duração e o intervalo definem os horários oferecidos aos pacientes.' : 'Abra uma consulta extra ou reserve um período ocupado para você. Este ajuste vale apenas para a data escolhida.'}</p>
    <form className="schedule-form" onSubmit={submit} aria-busy={busy} aria-describedby={validation || error ? errorId : undefined}>
      {!weekly && <fieldset className="schedule-kind" disabled={busy || Boolean(record)}><legend>Tipo de horário</legend>
        <label><input type="radio" name="schedule-kind" value="extra" checked={values.kind === 'extra'} onChange={() => update('kind', 'extra')} /><span><i className="bi bi-plus-circle" aria-hidden="true" />Disponível</span></label>
        <label><input type="radio" name="schedule-kind" value="bloqueio" checked={values.kind === 'bloqueio'} onChange={() => update('kind', 'bloqueio')} /><span><i className="bi bi-slash-circle" aria-hidden="true" />Ocupado</span></label>
      </fieldset>}
      {weekly ? <label className="admin-field"><span>Dia da semana</span><span className="field-control"><select ref={initialRef} value={values.dia_semana} onChange={(event) => update('dia_semana', event.target.value)} disabled={busy}>{WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></span></label>
        : <label className="admin-field"><span>Data</span><span className="field-control"><input ref={initialRef} type="date" required min={record ? undefined : clinicDateKey()} value={values.data} onChange={(event) => update('data', event.target.value)} disabled={busy} /></span></label>}
      <div className="schedule-form-pair">
        <label className="admin-field"><span>Horário inicial</span><span className="field-control"><input type="time" step="60" required value={values.hora_inicio} onChange={(event) => update('hora_inicio', event.target.value)} disabled={busy} /></span></label>
        <label className="admin-field"><span>Horário final</span><span className="field-control"><input type="time" step="60" required value={values.hora_fim} onChange={(event) => update('hora_fim', event.target.value)} disabled={busy} /></span></label>
      </div>
      {weekly && <div className="schedule-form-pair">
        <label className="admin-field"><span>Duração da consulta (min)</span><span className="field-control"><input type="number" min="1" max="1439" step="1" required value={values.duracao_minutos} onChange={(event) => update('duracao_minutos', event.target.value)} disabled={busy} /></span></label>
        <label className="admin-field"><span>Intervalo entre consultas (min)</span><span className="field-control"><input type="number" min="0" max="1439" step="1" required value={values.intervalo_minutos} onChange={(event) => update('intervalo_minutos', event.target.value)} disabled={busy} /></span></label>
      </div>}
      {values.kind === 'bloqueio' && <label className="admin-field"><span>Motivo (opcional)</span><span className="field-control"><input type="text" maxLength="150" autoComplete="off" placeholder="Ex.: compromisso pessoal" value={values.motivo} onChange={(event) => update('motivo', event.target.value)} disabled={busy} /></span><small className="schedule-field-note">Visível apenas na área administrativa.</small></label>}
      <p className="schedule-timezone">Horários de Brasília{!weekly && values.kind === 'extra' && timeMinutes(values.hora_fim) > timeMinutes(values.hora_inicio) ? ` · Uma consulta de ${timeMinutes(values.hora_fim) - timeMinutes(values.hora_inicio)} minutos` : ''}</p>
      {(validation || error) && <p role="alert" id={errorId} className="schedule-error">{validation || error}</p>}
      <div className="modal-actions schedule-form-actions"><button className="admin-button secondary-button" type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="admin-button schedule-save" type="submit" disabled={busy}>{busy ? 'Salvando…' : weekly ? 'Salvar período' : 'Salvar horário'}<i className="bi bi-arrow-up-right" aria-hidden="true" /></button></div>
    </form>
  </dialog>;
}
