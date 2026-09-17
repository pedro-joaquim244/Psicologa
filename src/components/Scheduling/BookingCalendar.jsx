import { useLayoutEffect, useRef, useState } from 'react';
import { bookingDateLabel, clinicDateKey, dateFromKey, localDateKey } from '../../utils/scheduling';

const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export default function BookingCalendar({ selected, onSelect, disabled }) {
  const today = clinicDateKey();
  const [month, setMonth] = useState(() => { const date = dateFromKey(today); date.setDate(1); return date; });
  const [focusDate, setFocusDate] = useState(today);
  const focusPending = useRef(false);
  const gridRef = useRef(null);
  const monthKey = localDateKey(month);
  const offset = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const title = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(month);

  useLayoutEffect(() => {
    if (focusPending.current) {
      gridRef.current?.querySelector(`[data-date="${focusDate}"]`)?.focus();
      focusPending.current = false;
    }
  }, [focusDate, monthKey]);

  const changeMonth = (delta) => {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1, 12);
    setMonth(next);
    setFocusDate(localDateKey(next) < today ? today : localDateKey(next));
  };

  const moveFocus = (event, key) => {
    const date = dateFromKey(key);
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -((date.getDay() + 6) % 7), End: 6 - ((date.getDay() + 6) % 7) };
    if (!(event.key in steps)) return;
    event.preventDefault();
    date.setDate(date.getDate() + steps[event.key]);
    if (localDateKey(date) < today) return;
    focusPending.current = true;
    setFocusDate(localDateKey(date));
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
  };

  return (
    <div className="booking-calendar" aria-label="Calendário de agendamento">
      <div className="booking-month">
        <button type="button" aria-label="Mês anterior" disabled={disabled || monthKey.slice(0, 7) <= today.slice(0, 7)} onClick={() => changeMonth(-1)}><i className="bi bi-arrow-left" aria-hidden="true" /></button>
        <h3 aria-live="polite">{title}</h3>
        <button type="button" aria-label="Próximo mês" disabled={disabled} onClick={() => changeMonth(1)}><i className="bi bi-arrow-right" aria-hidden="true" /></button>
      </div>
      <div className="booking-weekdays" aria-hidden="true">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
      <div ref={gridRef} className="booking-days">
        {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1;
          const key = localDateKey(new Date(month.getFullYear(), month.getMonth(), day, 12));
          return <button key={key} data-date={key} type="button" disabled={disabled || key < today} tabIndex={focusDate === key ? 0 : -1} aria-label={bookingDateLabel(key)} aria-pressed={selected === key} aria-current={key === today ? 'date' : undefined} onFocus={() => setFocusDate(key)} onKeyDown={(event) => moveFocus(event, key)} onClick={() => onSelect(key)}>{String(day).padStart(2, '0')}</button>;
        })}
      </div>
      <p className="booking-calendar-hint">Escolha um dia. Use as setas do teclado para navegar.</p>
    </div>
  );
}
