import { useState } from 'react';
import { images, site, whatsappUrl } from '../../config/site';
import Photo from '../Shared/Photo';
import ArrowLink from '../Shared/ArrowLink';
import CircularBadge from '../Shared/CircularBadge';
import SectionLabel from '../Shared/SectionLabel';
import '../../styles/cta.css';

const formats = [
  { value: 'online', label: 'Online', icon: 'bi-laptop', detail: 'Por videochamada, em um espaço reservado de sua escolha.', message: 'Olá! Tenho interesse no atendimento online. Gostaria de saber sobre horários, valores e como funciona a primeira sessão.' },
  { value: 'presencial', label: 'Presencial', icon: 'bi-door-open', detail: `Um encontro presencial em ${site.location}.`, message: `Olá! Tenho interesse no atendimento presencial em ${site.location}. Gostaria de saber sobre horários, valores e como funciona a primeira sessão.` },
  { value: 'conversar', label: 'Quero conversar', icon: 'bi-chat-text', detail: 'Tudo bem ter dúvidas. Podemos conversar sobre as possibilidades.', message: 'Olá! Gostaria de conversar sobre as possibilidades de atendimento e tirar algumas dúvidas antes de agendar.' },
];

export default function CTA() {
  const [selected, setSelected] = useState('conversar');
  const format = formats.find((option) => option.value === selected);
  return (
    <section id="contato" className="cta-section" aria-labelledby="cta-title">
      <div className="page-container cta-grid">
        <div className="cta-copy">
        <SectionLabel number="12" data-reveal>PRIMEIRO PASSO</SectionLabel>
        <h2 id="cta-title" data-reveal>Que tal reservar<br />um tempo para <em>você?</em></h2>
        <p className="cta-description" data-reveal>Entre em contato para conversarmos sobre o atendimento e tirarmos suas dúvidas.</p>
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
          <ArrowLink href={whatsappUrl(format.message)} external className="button button-dark cta-button"><i className="bi bi-whatsapp" aria-hidden="true" /> Agendar pelo WhatsApp</ArrowLink>
          <p className="contact-hint">Você poderá revisar a mensagem antes de enviar.</p>
        </div>
        <span className="cta-note">O PRIMEIRO PASSO PODE SER UMA CONVERSA.</span>
        </div>
        <div className="cta-visual"><figure className="cta-photo" data-image-reveal><Photo image={images.closing} sizes="(max-width: 650px) 90vw, (max-width: 1600px) 36vw, 520px" /></figure><CircularBadge /><p className="cta-photo-note">Seu próximo capítulo<br /><em>pode começar aqui.</em></p></div>
      </div>
    </section>
  );
}
