import { bookingDateLabel } from '../../utils/scheduling';

export default function BookingForm({ date, slot, values, onChange, errors, submitting, onSubmit }) {
  const fields = [
    { name: 'nome', label: 'Nome completo', autoComplete: 'name', type: 'text', placeholder: 'Como podemos chamar você?' },
    { name: 'telefone', label: 'WhatsApp', autoComplete: 'tel', type: 'tel', placeholder: '(16) 99999-9999' },
    { name: 'email', label: 'E-mail', autoComplete: 'email', type: 'email', placeholder: 'seu@email.com' },
  ];
  return (
    <form className="booking-form" onSubmit={onSubmit} noValidate>
      <fieldset disabled={submitting}>
        <legend className="booking-step"><span>03</span> Seus dados</legend>
        <div className="booking-fields">
          {fields.map(({ name, label, ...input }) => <div className="booking-field" key={name}>
            <label htmlFor={`booking-${name}`}>{label}</label>
            <input {...input} id={`booking-${name}`} name={name} value={values[name]} readOnly aria-invalid={Boolean(errors[name])} aria-describedby={`booking-account-note${errors[name] ? ` booking-error-${name}` : ''}`} />
            {errors[name] && <span id={`booking-error-${name}`} className="booking-field-error">{errors[name]}</span>}
          </div>)}
        </div>
        <p id="booking-account-note" className="booking-privacy">Dados da sua conta de paciente.</p>
        <fieldset className="booking-modality">
          <legend>Modalidade</legend>
          {['online', 'presencial'].map((value) => <label key={value}><input type="radio" name="booking-modalidade" value={value} checked={values.modalidade === value} onChange={() => onChange('modalidade', value)} required /><span>{value === 'online' ? 'Online' : 'Presencial'}</span></label>)}
        </fieldset>
      </fieldset>
      <div className="booking-summary" aria-live="polite">
        <p className="eyebrow">SUA CONSULTA</p><h3>{bookingDateLabel(date)}</h3>
        <p>{slot.horario} — {slot.fim} <span>·</span> {values.modalidade === 'online' ? 'Online' : 'Presencial'}</p>
      </div>
      <button className="button button-dark booking-submit" type="submit" disabled={submitting}>{submitting ? 'Reservando seu horário…' : 'Confirmar agendamento'}<i className="bi bi-arrow-up-right" aria-hidden="true" /></button>
      <p className="booking-privacy">Seus dados serão usados para organizar este atendimento e entrar em contato com você.</p>
    </form>
  );
}
