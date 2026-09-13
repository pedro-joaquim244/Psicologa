import { useEffect, useRef } from "react";

export default function ConfirmationModal({ appointment, busy, onClose, onConfirm, title, description, confirmLabel = 'Cancelar agendamento', error }) {
  const dialogRef = useRef(null);
  const backButtonRef = useRef(null);
  const lastActiveRef = useRef(null);
  const busyRef = useRef(busy);

  busyRef.current = busy;

  useEffect(() => {
    if (!appointment) return undefined;
    lastActiveRef.current = document.activeElement;
    backButtonRef.current?.focus();
    const dialog = dialogRef.current;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busyRef.current) onClose();
      if (event.key !== "Tab") return;
      const focusable = [...dialog.querySelectorAll("button:not(:disabled), a[href], input:not(:disabled)")];
      if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("modal-open");
      lastActiveRef.current?.focus?.();
    };
  }, [appointment, onClose]);

  if (!appointment) return null;

  return (
    <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div ref={dialogRef} className="admin-modal" tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="cancel-title" aria-describedby="cancel-description">
        <span className="modal-number" aria-hidden="true">×</span>
        <p className="admin-kicker">ALTERAR AGENDAMENTO</p>
        <h2 id="cancel-title">{title || <>Cancelar este<br /><em>agendamento?</em></>}</h2>
        <p id="cancel-description">{description || <>O atendimento de <strong>{appointment.nome_cliente}</strong> será cancelado e este horário poderá ficar disponível novamente.</>}</p>
        {error && <p className="patient-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button ref={backButtonRef} type="button" className="admin-button secondary-button" onClick={onClose} disabled={busy}>Voltar</button>
          <button type="button" className="admin-button danger-button" onClick={onConfirm} disabled={busy}>{busy ? "Cancelando…" : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
