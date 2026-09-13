import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SectionLabel from '../Shared/SectionLabel';
import FloralMark from '../Shared/FloralMark';
import BookingCalendar from './BookingCalendar';
import BookingForm from './BookingForm';
import { createAppointment, listAvailableSlots } from '../../services/api';
import { bookingDateLabel, localDateKey, validateBooking } from '../../utils/scheduling';
import { ScrollTrigger } from '../../lib/motion';
import '../../styles/scheduling.css';

const emptyForm = { nome: '', telefone: '', email: '', modalidade: 'online' };

export default function Scheduling() {
  const { isPatient, isProfessional, token, user } = useAuth();
  const location = useLocation();
  const resumeBooking = useRef(location.state?.booking);
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState(null);
  const [availability, setAvailability] = useState({ date: '', slots: [], loading: false, error: '' });
  const [values, setValues] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const request = useRef(null);
  const submittingRef = useRef(false);
  const rootRef = useRef(null);
  const successRef = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    setValues(isPatient ? { nome: user.nome, telefone: user.telefone || '', email: user.email, modalidade: 'online' } : emptyForm);
  }, [isPatient, user]);

  useEffect(() => {
    mounted.current = true;
    let timer;
    let lastHeight = 0;
    const observer = new ResizeObserver(([entry]) => {
      if (Math.abs(entry.contentRect.height - lastHeight) < 1) return;
      lastHeight = entry.contentRect.height;
      clearTimeout(timer);
      // Aguarda a rolagem terminar para não interromper a navegação por âncoras.
      timer = setTimeout(() => ScrollTrigger.refresh(true), 100);
    });
    observer.observe(rootRef.current);
    const previous = resumeBooking.current;
    if (previous?.date >= localDateKey()) {
      setDate(previous.date);
      loadSlots(previous.date, '', previous.horario);
    }
    return () => { mounted.current = false; request.current?.abort(); observer.disconnect(); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (receipt) successRef.current?.focus();
  }, [receipt]);

  const loadSlots = async (selectedDate, exclude = '', preferred = '') => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setAvailability({ date: selectedDate, slots: [], loading: true, error: '' });
    try {
      const slots = await listAvailableSlots(selectedDate, { signal: controller.signal });
      if (controller.signal.aborted || !mounted.current) return;
      // The server owns availability; also omit times already elapsed today.
      const now = new Date();
      setAvailability({ date: selectedDate, slots: slots.filter((item) => item.horario !== exclude && new Date(`${selectedDate}T${item.horario}:00`) > now), loading: false, error: '' });
      if (preferred) setSlot(slots.find((item) => item.horario === preferred && new Date(`${selectedDate}T${item.horario}:00`) > now) || null);
    } catch (error) {
      if (controller.signal.aborted || !mounted.current) return;
      setAvailability({ date: selectedDate, slots: [], loading: false, error: error.message });
    }
  };

  const selectDate = (selectedDate) => {
    if (submittingRef.current || selectedDate < localDateKey()) return;
    setDate(selectedDate);
    setSlot(null);
    setReceipt(null);
    setMessage('');
    loadSlots(selectedDate);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submittingRef.current || !date || !slot || !isPatient) return;
    const validation = validateBooking(values);
    setErrors(validation);
    if (Object.keys(validation).length) {
      requestAnimationFrame(() => rootRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    if (new Date(`${date}T${slot.horario}:00`) <= new Date()) {
      setMessage('Esse horário já passou. Escolha outro horário.');
      setSlot(null);
      loadSlots(date);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setMessage('');
    const payload = { nome: values.nome.trim(), telefone: values.telefone.replace(/\D/g, ''), email: values.email.trim(), modalidade: values.modalidade, data: date, horario: slot.horario };
    try {
      const result = await createAppointment(payload, token);
      if (!mounted.current) return;
      setReceipt({ data: payload.data, horario: payload.horario, fim: result.horarioFim || slot.fim, modalidade: payload.modalidade });
      setValues({ nome: user.nome, telefone: user.telefone || '', email: user.email, modalidade: 'online' });
      setErrors({});
      setSlot(null);
      setDate('');
      loadSlots(payload.data, payload.horario);
    } catch (error) {
      if (!mounted.current) return;
      if (error.status === 409) {
        setMessage('Esse horário acabou de ser reservado. Escolha outro horário.');
        setSlot(null);
        loadSlots(payload.data, payload.horario);
      } else {
        setMessage(error.message);
      }
    } finally {
      submittingRef.current = false;
      if (mounted.current) setSubmitting(false);
    }
  };

  const closeReceipt = () => {
    setReceipt(null);
    rootRef.current?.querySelector('.booking-days button:not(:disabled)')?.focus();
  };

  return (
    <section ref={rootRef} id="agendamento" className="scheduling-section section-space" aria-labelledby="booking-title">
      <div className="page-container">
        <div className="booking-heading">
          <div><SectionLabel>AGENDAMENTO</SectionLabel><h2 id="booking-title" className="display-title">Um encontro.<br /><em>Um tempo para você.</em></h2></div>
          <div className="booking-intro"><FloralMark /><p>Escolha um dia e um horário disponível para começar. Depois, conte como podemos entrar em contato.</p></div>
        </div>
        <div className="booking-layout">
          <div className="booking-date-column">
            <h3 className="booking-step"><span>01</span> Escolha o dia</h3>
            <BookingCalendar selected={date} onSelect={selectDate} disabled={submitting} />
          </div>
          <div className="booking-details">
            {receipt && <div ref={successRef} className="booking-success" tabIndex={-1} role="status" aria-labelledby="booking-success-title">
              <FloralMark /><p className="eyebrow">UM TEMPO RESERVADO</p><h3 id="booking-success-title">Agendamento realizado</h3>
              <p>Sua conversa foi reservada para:</p><strong>{bookingDateLabel(receipt.data)}</strong>
              <p>{receipt.horario} — {receipt.fim} · {receipt.modalidade === 'online' ? 'Online' : 'Presencial'}</p>
              <button type="button" className="text-link" onClick={closeReceipt}>Fechar confirmação <i className="bi bi-check2" aria-hidden="true" /></button>
            </div>}
            {!receipt && <>
              <h3 className="booking-step"><span>02</span> Escolha o horário</h3>
              {!date && <div className="booking-placeholder"><FloralMark /><h3>Cabe uma pausa<br /><em>na sua semana.</em></h3><p>Selecione uma data no calendário para ver os horários disponíveis.</p></div>}
            </>}
            {message && <p className="booking-feedback" role="alert">{message}</p>}
            {date && <div className="booking-availability" aria-busy={availability.loading}>
              <p className="booking-selected-date">{bookingDateLabel(date)}</p>
              {availability.loading && <p role="status">Buscando horários disponíveis…</p>}
              {availability.error && <div className="booking-feedback" role="alert"><p>{availability.error}</p><button type="button" className="text-link" onClick={() => loadSlots(date)}>Tentar novamente</button></div>}
              {!availability.loading && !availability.error && availability.date === date && <>
                {!availability.slots.length && <div className="booking-empty" role="status"><p>Não há horários disponíveis para esta data.</p><button type="button" className="text-link" onClick={() => rootRef.current?.querySelector('.booking-days button:not(:disabled)')?.focus()}>Escolher outro dia</button></div>}
                <div className="booking-slots" role="group" aria-label="Horários disponíveis">{availability.slots.map((item) => <button key={item.horario} type="button" disabled={submitting} aria-pressed={slot?.horario === item.horario} onClick={() => { setSlot(item); setMessage(''); }}><strong>{item.horario}</strong><small>até {item.fim}</small></button>)}</div>
              </>}
            </div>}
            {!isPatient && !receipt && <div className="booking-login-gate">
              <h3>{isProfessional ? 'Agendamento para pacientes' : 'Entre para reservar sua consulta'}</h3>
              <p>{isProfessional ? 'Para reservar, use uma conta de paciente. Sua agenda profissional está disponível no menu.' : 'Escolha seu horário e entre na sua conta. Se for sua primeira vez, crie seu cadastro.'}</p>
              <Link className="button button-dark" to="/login" state={{ booking: { date, horario: slot?.horario } }}>Entrar como paciente</Link>
              <Link className="text-link" to="/cadastro" state={{ booking: { date, horario: slot?.horario } }}>Criar conta</Link>
            </div>}
            {date && slot && isPatient && <BookingForm date={date} slot={slot} values={values} errors={errors} submitting={submitting} onSubmit={submit} onChange={(key, value) => { setValues((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined })); }} />}
          </div>
        </div>
      </div>
    </section>
  );
}
