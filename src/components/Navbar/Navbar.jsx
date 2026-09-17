import { useEffect, useRef, useState } from 'react';
import { site } from '../../config/site';
import SectionLink from '../Shared/SectionLink';
import UserMenu from '../UserMenu/UserMenu';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../styles/navbar.css';

const links = [['Início', 'inicio'], ['Sobre', 'sobre'], ['Abordagem', 'abordagem'], ['Atendimento', 'atendimento'], ['FAQ', 'faq']];

export default function Navbar() {
  const { isAuthenticated, isProfessional, isPatient, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('inicio');
  const toggleRef = useRef(null);
  const headerRef = useRef(null);

  useEffect(() => {
    let frame;
    const sections = [...links.map(([, id]) => id), 'agendamento', 'contato'].map((id) => document.getElementById(id)).filter(Boolean);
    const update = () => {
      frame = undefined;
      const header = headerRef.current;
      if (!header) return;
      setScrolled(window.scrollY > 24);
      const threshold = header.offsetHeight + 80;
      const current = sections.filter((section) => section.getBoundingClientRect().top <= threshold).at(-1);
      setActive(current?.id || (sections.length ? 'inicio' : null));
      const distance = document.documentElement.scrollHeight - window.innerHeight;
      const progress = distance > 0 ? Math.max(0, Math.min(1, window.scrollY / distance)) : 0;
      header.style.setProperty('--reading-progress', progress);
    };
    const schedule = () => { if (frame === undefined) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === 'Escape') { setOpen(false); toggleRef.current?.focus(); }
    };
    const onOutside = (event) => { if (!headerRef.current?.contains(event.target)) setOpen(false); };
    const desktop = window.matchMedia('(min-width: 1200px)');
    const onResize = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onOutside);
    desktop.addEventListener('change', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onOutside);
      desktop.removeEventListener('change', onResize);
    };
  }, [open]);

  return (
    <header ref={headerRef} className={`site-header ${scrolled ? 'is-scrolled' : ''} ${open ? 'menu-open' : ''}`}>
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <div className="page-container header-inner">
        <SectionLink section="inicio" className="brand" aria-label={`${site.name}, início`} onClick={() => setOpen(false)}>
          <span className="brand-monogram" aria-hidden="true">h<span>m</span></span>
          <span className="brand-copy"><span>{site.name}</span><small>PSICOLOGIA & ESCUTA</small></span>
        </SectionLink>
        <button ref={toggleRef} className="menu-toggle" type="button" aria-expanded={open} aria-controls="main-navigation" aria-label={open ? 'Fechar menu' : 'Abrir menu'} onClick={() => setOpen(!open)}>
          <span /> <span />
        </button>
        <nav id="main-navigation" className={`main-navigation ${open ? 'is-open' : ''}`} aria-label="Navegação principal">
          {links.map(([label, id]) => <SectionLink key={id} section={id} aria-current={active === id ? 'location' : undefined} onClick={() => setOpen(false)}>{label}</SectionLink>)}
          <SectionLink section="agendamento" className="arrow-link header-cta" aria-current={['agendamento', 'contato'].includes(active) ? 'location' : undefined} onClick={() => setOpen(false)}><span>Agendar consulta</span><i className="bi bi-arrow-up-right" aria-hidden="true" /></SectionLink>
          {!isAuthenticated ? <Link to="/login" onClick={() => setOpen(false)}>Entrar</Link> : isPatient ? <UserMenu onNavigate={() => setOpen(false)} /> : <>
            {isProfessional && <Link to="/adm/agenda" onClick={() => setOpen(false)}>Minha agenda</Link>}
            <button className="header-logout" type="button" onClick={() => { logout(); setOpen(false); }}>Sair</button>
          </>}
        </nav>
      </div>
      <span className="reading-progress" aria-hidden="true" />
    </header>
  );
}
