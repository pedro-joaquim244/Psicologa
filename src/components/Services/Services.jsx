import { useState } from 'react';
import { images, site, whatsappUrl } from '../../config/site';
import ArrowLink from '../Shared/ArrowLink';
import Photo from '../Shared/Photo';
import SectionLabel from '../Shared/SectionLabel';
import '../../styles/services.css';

const services = [
  { title: 'presencial', icon: 'bi-door-open', text: 'Sessões realizadas em um ambiente reservado, confortável e acolhedor.', location: site.location, locationIcon: 'bi-geo-alt', image: images.inPerson, caption: 'Um lugar para chegar com calma.' },
  { title: 'online', icon: 'bi-laptop', text: 'Atendimento por videochamada, permitindo que o processo terapêutico aconteça de onde você estiver.', location: 'Cuidado que atravessa distâncias', locationIcon: 'bi-globe2', image: images.online, caption: 'Presença, mesmo à distância.' },
];

export default function Services() {
  const [active, setActive] = useState(0);
  return (
    <section id="atendimento" className="services-section section-space page-container" aria-labelledby="services-title">
      <div className="section-intro row g-0"><SectionLabel number="07" className="col-lg-4" data-reveal>ATENDIMENTO</SectionLabel><h2 id="services-title" className="display-title col-lg-8" data-reveal>Um espaço que pode<br />acompanhar você<br /><em>onde estiver.</em></h2></div>
      <div className="services-editorial service-list">
        {services.map((service, index) => (
          <article className={`service-row ${active === index ? 'is-active' : ''}`} key={service.title} onPointerEnter={() => setActive(index)} onFocus={() => setActive(index)}>
            <figure className="services-preview">
              <Photo image={service.image} className={active === index ? 'is-active' : ''} sizes="(max-width: 650px) 100vw, (max-width: 1600px) 45vw, 650px" />
              <figcaption>{service.caption}</figcaption>
            </figure>
            <div className="service-content">
              <span className="service-number" aria-hidden="true">0{index + 1}</span>
              <div className="service-title"><h3>Psicoterapia<br /><em>{service.title}</em></h3><i className={`bi ${service.icon}`} aria-hidden="true" /></div>
              <div className="service-description"><p>{service.text}</p><span className="service-location"><i className={`bi ${service.locationIcon}`} aria-hidden="true" /> {service.location}</span></div>
              <ArrowLink href={whatsappUrl(`Olá! Gostaria de saber mais sobre a psicoterapia ${service.title}.`)} external className="service-link" aria-label={`Saiba mais sobre psicoterapia ${service.title} pelo WhatsApp`}>Saiba mais</ArrowLink>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
