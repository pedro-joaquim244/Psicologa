import { useState } from 'react';
import { images } from '../../config/site';
import Photo from '../Shared/Photo';
import ArrowLink from '../Shared/ArrowLink';
import CircularBadge from '../Shared/CircularBadge';
import SectionLabel from '../Shared/SectionLabel';
import '../../styles/cta.css';

const formats = [
  { value: 'online', label: 'Online', icon: 'bi-laptop', detail: 'Por videochamada, em um espaço reservado de sua escolha.' },
  { value: 'presencial', label: 'Presencial', icon: 'bi-door-open', detail: 'Os detalhes do atendimento presencial são confirmados após a solicitação.' },
  { value: 'conversar', label: 'Quero conhecer', icon: 'bi-chat-text', detail: 'Tudo bem ter dúvidas. A primeira solicitação pode ser o começo da conversa.' },
];

export default function CTA() {
  const [selected, setSelected] = useState('conversar');
  const format = formats.find((option) => option.value === selected);
  return (
    <section id="contato" className="cta-section" aria-labelledby="cta-title">
      <div className="page-container cta-grid">
        <div className="cta-copy">
        <SectionLabel number="12" data-reveal>PRIMEIRO PASSO</SectionLabel>
        <h2 id="cta-title" data-reveal>Prefere conversar<br />antes de <em>reservar?</em></h2>
        <p className="cta-description" data-reveal>Tire dúvidas sobre formatos, disponibilidade e como funciona o primeiro encontro. Sem compromisso.</p>
        <div className="contact-options" data-reveal>
          <fieldset>
            <legend>Qual formato faz sentido para você?</legend>
            <div className="format-options">
              {formats.map((option) => (
                <label className="format-option" key={option.value}>
                  <input type="radio" name="formato-atendimento" value={option.value} checked={selected === option.value} onChange={() => setSelected(option.value)} aria-describedby="format-description" />
                  <span><i className={`bi ${option.icon}`} aria-hidden="true" />{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p id="format-description" className="format-description" aria-live="polite" aria-atomic="true">{format.detail}</p>
          <ArrowLink href="#agendamento" className="button button-dark cta-button"><i className="bi bi-calendar-check" aria-hidden="true" /> Ver horários disponíveis</ArrowLink>
          <p className="contact-hint">A agenda mostra as datas disponíveis e permite revisar tudo antes de confirmar.</p>
        </div>
        <span className="cta-note">A CONVERSA TAMBÉM PODE SER O PRIMEIRO PASSO.</span>
        </div>
        <div className="cta-visual"><figure className="cta-photo" data-image-reveal><Photo image={images.closing} sizes="(max-width: 650px) 90vw, (max-width: 1600px) 36vw, 520px" /></figure><CircularBadge /><p className="cta-photo-note">Seu próximo capítulo<br /><em>pode começar aqui.</em></p></div>
      </div>
    </section>
  );
}
