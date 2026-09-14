import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function UserMenu({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const menuId = useId();
  const name = user?.nome?.trim() || 'Minha conta';
  const close = () => { setOpen(false); onNavigate(); };

  useEffect(() => {
    if (!open) return;
    const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  function keyboard(event) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    setOpen(true);
    requestAnimationFrame(() => {
      const items = [...root.current.querySelectorAll('[role="menuitem"]')];
      const index = items.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : index < 0 ? (event.key === 'ArrowUp' ? items.length - 1 : 0) : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    });
  }

  return (
    <div className="user-menu" ref={root} onKeyDown={keyboard} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <button ref={trigger} type="button" className="user-menu-trigger" aria-expanded={open} aria-haspopup="menu" aria-controls={menuId} onClick={() => setOpen(!open)}>
        <span title={name}>{name.split(/\s+/)[0]}</span><i className="bi bi-chevron-down" aria-hidden="true" />
      </button>
      {open && <div className="user-menu-panel" id={menuId}>
        <div className="user-menu-identity"><strong>{name}</strong><span>{user.email}</span></div>
        <div role="menu" aria-label="Sua conta">
          <Link role="menuitem" to="/minhas-consultas" onClick={close}>Minhas consultas <i className="bi bi-arrow-up-right" aria-hidden="true" /></Link>
          <Link role="menuitem" to="/minha-conta" onClick={close}>Minha conta</Link>
          <button role="menuitem" type="button" onClick={() => { logout(); close(); navigate('/login', { replace: true }); }}>Sair</button>
        </div>
      </div>}
    </div>
  );
}
