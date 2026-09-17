import { useMemo, useState } from 'react';
import { DAY_ORDER, WEEKDAYS } from '../../utils/agendaManagement';
import ScheduleDialog from './ScheduleDialog';

const titles = {
  copiar: 'Copiar horários para outros dias',
  remover: 'Remover horários selecionados',
  duracao: 'Alterar duração das consultas',
  bloquear: 'Bloquear horários selecionados',
  duplicar: 'Duplicar horários para outros dias',
};

const descriptions = {
  copiar: 'Os horários da origem serão copiados para os dias escolhidos. Horários já existentes serão preservados.',
  remover: 'As consultas já marcadas são preservadas. A operação será recusada se um horário necessário para uma consulta deixar de existir.',
  duracao: 'A nova duração precisa caber no mesmo dia e não pode alterar consultas existentes.',
  bloquear: 'O bloqueio impede novos agendamentos. Consultas já existentes nunca são canceladas automaticamente.',
  duplicar: 'Crie cópias dos horários selecionados em outros dias da semana. Duplicatas serão ignoradas.',
};

function selectionPayload(selected) {
  return (Array.isArray(selected) ? selected : [])
    .filter((slot) => Number.isInteger(Number(slot?.id)) && Number(slot.id) > 0 && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(slot?.horario || '')))
    .map((slot) => ({ id: Number(slot.id), horario: String(slot.horario).slice(0, 5) }));
}

export default function ScheduleBulkModal({ action, selected, sourceDay, defaults, busy, error, onClose, onSave }) {
  const initialDays = useMemo(() => [], []);
  const [days, setDays] = useState(initialDays);
  const [duration, setDuration] = useState(String(defaults?.duracao_padrao || 50));
  const [reason, setReason] = useState('');
  const [validation, setValidation] = useState('');
  const slots = useMemo(() => selectionPayload(selected), [selected]);
  const needsDays = action === 'copiar' || action === 'duplicar';

  const toggleDay = (day) => {
    setValidation('');
    setDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day]);
  };

  const submit = (event) => {
    event.preventDefault();
    if (busy) return;
    if (!slots.length && action !== 'copiar') {
      setValidation('A seleção não é mais válida. Atualize a agenda e tente novamente.');
      return;
    }
    if (needsDays && !days.length) {
      setValidation('Selecione pelo menos um dia de destino.');
      return;
    }

    if (action === 'copiar') {
      onSave({ origem_dia: sourceDay, dias_destino: days });
      return;
    }

    const payload = { acao: action, selecionados: slots };
    if (action === 'duracao') {
      const value = Number(duration);
      if (!Number.isInteger(value) || value < 1 || value > 1439) {
        setValidation('Informe uma duração entre 1 e 1439 minutos.');
        return;
      }
      payload.duracao_minutos = value;
    }
    if (action === 'bloquear') payload.motivo = reason.trim();
    if (action === 'duplicar') payload.dias_destino = days;
    onSave(payload);
  };

  return (
    <ScheduleDialog title={titles[action] || 'Alterar horários'} description={descriptions[action]} busy={busy} onClose={onClose}>
      <form className="schedule-form schedule-bulk-form" onSubmit={submit} aria-busy={busy}>
        <p className="schedule-subtle"><strong>{action === 'copiar' ? 'Todos os horários do dia de origem' : `${slots.length} horário${slots.length === 1 ? '' : 's'} selecionado${slots.length === 1 ? '' : 's'}`}</strong></p>
        {needsDays && <fieldset className="schedule-range-days">
          <legend>{action === 'copiar' ? 'Copiar para' : 'Duplicar para'}</legend>
          {DAY_ORDER.map((day) => <label key={day}>
            <input type="checkbox" checked={days.includes(day)} disabled={busy || (action === 'copiar' && day === sourceDay)} onChange={() => toggleDay(day)} />
            {WEEKDAYS[day]}
          </label>)}
        </fieldset>}
        {action === 'duracao' && <label className="admin-field"><span>Nova duração (minutos)</span><span className="field-control"><input type="number" required min="1" max="1439" step="1" value={duration} disabled={busy} onChange={(event) => { setValidation(''); setDuration(event.target.value); }} /></span></label>}
        {action === 'bloquear' && <label className="admin-field"><span>Motivo (opcional)</span><span className="field-control"><input type="text" maxLength="150" autoComplete="off" value={reason} disabled={busy} onChange={(event) => { setValidation(''); setReason(event.target.value); }} /></span><small className="schedule-field-note">Visível apenas na área administrativa.</small></label>}
        {(validation || error) && <p className="schedule-error" role="alert">{validation || error}</p>}
        <div className="modal-actions schedule-form-actions">
          <button className="admin-button secondary-button" type="button" disabled={busy} onClick={onClose}>Cancelar</button>
          <button className={`admin-button ${action === 'remover' ? 'danger-button' : 'schedule-save'}`} type="submit" disabled={busy}>{busy ? 'Salvando…' : action === 'remover' ? 'Remover horários' : 'Confirmar alteração'}</button>
        </div>
      </form>
    </ScheduleDialog>
  );
}
