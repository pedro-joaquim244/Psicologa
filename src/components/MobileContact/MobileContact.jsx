import { useEffect, useState } from 'react';
import ArrowLink from '../Shared/ArrowLink';
import '../../styles/mobile-contact.css';

export default function MobileContact() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById('inicio');
    const contact = document.getElementById('contato');
    const mobile = window.matchMedia('(max-width: 650px)');
    const update = () => setVisible(mobile.matches && hero.getBoundingClientRect().bottom <= 0 && contact.getBoundingClientRect().top > window.innerHeight + 96);
    const observer = new IntersectionObserver(update, { rootMargin: '0px 0px 96px 0px' });
    observer.observe(hero);
    observer.observe(contact);
    mobile.addEventListener('change', update);
    update();
    return () => { observer.disconnect(); mobile.removeEventListener('change', update); };
  }, []);

  return (
    <aside className="mobile-contact" aria-label="Agendamento rápido" hidden={!visible}>
      <span>Um tempo<br /><em>para você.</em></span>
      <ArrowLink href="#contato" className="button button-dark" aria-label="Escolher atendimento e agendar">Agendar conversa</ArrowLink>
    </aside>
  );
}
