import { useState } from 'react';
import { images, site, whatsappUrl } from '../../config/site';
import ArrowLink from '../Shared/ArrowLink';
import SectionLabel from '../Shared/SectionLabel';
import '../../styles/services.css';

export default function Services() {
  const [active, setActive] = useState(0);
  const services = [
    { title: 'presencial', icon: 'bi-door-open', text: 'Sessões realizadas em um ambiente reservado, confortável e acolhedor.', location: site.location, locationIcon: 'bi-geo-alt', image: images.hero },
    { title: 'online', icon: 'bi-laptop', text: 'Atendimento por videochamada, permitindo que o processo terapêutico aconteça de onde você estiver.', location: 'Cuidado que atravessa distâncias', locationIcon: 'bi-globe2', image: images.detail },
  ];
  return (
    <section id="atendimento" className="services-section section-space page-container" aria-labelledby="services-title">
      <div className="section-intro row g-0"><SectionLabel number="07" className="col-lg-4" data-reveal>ATENDIMENTO</SectionLabel><h2 id="services-title" className="display-title col-lg-8" data-reveal>Um espaço que pode<br />acompanhar você<br /><em>onde estiver.</em></h2></div>
      <div className="services-editorial">
        <figure className="services-preview" aria-hidden="true">{services.map((service, index) => <img key={service.title} className={active === index ? 'is-active' : ''} src={service.image.src} alt="" width="600" height="800" loading="lazy" />)}<figcaption>O cuidado também está no encontro.</figcaption></figure>
        <div className="service-list">{services.map((service, index) => <article className={`service-row ${active === index ? 'is-active' : ''}`} data-reveal key={service.title} onPointerEnter={() => setActive(index)} onFocus={() => setActive(index)}><span className="service-number">0{index + 1}</span><div className="service-title"><i className={`bi ${service.icon}`} aria-hidden="true" /><h3>Psicoterapia<br /><em>{service.title}</em></h3></div><div className="service-description"><p>{service.text}</p><span className="service-location"><i className={`bi ${service.locationIcon}`} aria-hidden="true" /> {service.location}</span></div><ArrowLink href={whatsappUrl(`Olá! Gostaria de saber mais sobre a psicoterapia ${service.title}.`)} external className="service-link" aria-label={`Saiba mais sobre psicoterapia ${service.title} pelo WhatsApp`}>Saiba mais</ArrowLink></article>)}</div>
      </div>
    </section>
  );
}
