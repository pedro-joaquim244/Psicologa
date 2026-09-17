import { useId, useLayoutEffect, useRef } from 'react';

function focusableElements(dialog) {
  return [...dialog.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hasAttribute('hidden'));
}

export default function ScheduleDialog({ title, description, busy = false, onClose, children }) {
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  closeRef.current = onClose;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    previousFocus.current = document.activeElement;
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('modal-open');

    const first = focusableElements(dialog)[0];
    (first || dialog).focus();

    return () => {
      if (dialog.open) dialog.close();
      document.body.classList.remove('modal-open');
      previousFocus.current?.focus?.();
    };
  }, []);

  const trapFocus = (event) => {
    if (event.key !== 'Tab') return;
    const elements = focusableElements(dialogRef.current);
    if (!elements.length) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = elements[0];
    const last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const requestClose = () => {
    if (!busy) closeRef.current?.();
  };

  return (
    <dialog
      ref={dialogRef}
      className="schedule-dialog schedule-context-dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => { event.preventDefault(); requestClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) requestClose(); }}
      onKeyDown={trapFocus}
    >
      <div className="schedule-dialog-header">
        <p className="admin-kicker">ORGANIZAR SEUS HORÁRIOS</p>
        <button type="button" className="schedule-dialog-close" aria-label="Fechar" onClick={requestClose} disabled={busy}>×</button>
      </div>
      <h2 id={titleId}>{title}</h2>
      {description && <p id={descriptionId} className="schedule-dialog-description">{description}</p>}
      {children}
    </dialog>
  );
}
