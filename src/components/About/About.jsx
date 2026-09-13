import { useRef } from 'react';
import { images, site } from '../../config/site';
import Photo from '../Shared/Photo';
import ArrowLink from '../Shared/ArrowLink';
import SectionLabel from '../Shared/SectionLabel';
import { gsap, useScrollScene } from '../../lib/motion';
import '../../styles/about.css';

function animatePortraits({ desktop, tablet, reduced }, root) {
  if (reduced) return;
  gsap.timeline({ scrollTrigger: { trigger: root, start: 'top 85%', end: 'center 60%', scrub: 1 } })
    .fromTo('.portrait-frame', { clipPath: 'inset(35% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 1, ease: 'none' })
    .fromTo('.about-detail-photo', { clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0%)', duration: .7, ease: 'none' }, .25);
  if (desktop || tablet) gsap.timeline({ scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: 1 } })
    .fromTo('.portrait-frame img', { yPercent: -3, scale: 1.1 }, { yPercent: 3, scale: 1.1, ease: 'none' }, 0)
    .fromTo('.about-detail', { y: desktop ? 45 : 16 }, { y: desktop ? -45 : -16, ease: 'none' }, 0);
}

export default function About() {
  const ref = useRef(null);
  useScrollScene(ref, animatePortraits);
  return (
    <section id="sobre" ref={ref} className="about-section section-space" aria-labelledby="about-title">
      <div className="page-container row align-items-center g-0 justify-content-between">
        <div className="col-lg-5 about-visual">
          <span className="portrait-number" aria-hidden="true">03</span><span className="portrait-side-label eyebrow">PSICÓLOGA CLÍNICA</span>
          <figure className="portrait-frame"><Photo image={images.portrait} sizes="(max-width: 650px) 90vw, (max-width: 1600px) 40vw, 580px" /></figure>
          <div className="portrait-caption"><span>{site.shortName}</span><span className="eyebrow">PRESENÇA ANTES DE TUDO.</span></div>
          <figure className="about-detail"><div className="about-detail-photo"><Photo image={images.detail} sizes="(max-width: 650px) 60vw, 24vw" /></div><figcaption>Há espaço para a sua história.</figcaption></figure>
        </div>
        <div className="col-lg-6 about-copy"><SectionLabel number="03" data-reveal>SOBRE MIM</SectionLabel><h2 id="about-title" className="display-title" data-reveal>Escutar também<br />é uma forma<br />de <em>cuidar.</em></h2><div className="about-body" data-reveal><p>Sou psicóloga clínica e meu trabalho é oferecer um espaço acolhedor para que você possa compreender suas emoções, experiências e relações com mais profundidade.</p><p>Acredito em uma psicoterapia construída através do vínculo, da escuta e do respeito à singularidade de cada pessoa.</p></div><div className="about-credentials" data-reveal><span>{site.profession}<small>{site.crp}</small></span><span>Presencial e online<small>{site.location}</small></span></div><ArrowLink className="text-link" href="#abordagem">Um pouco sobre o meu olhar</ArrowLink></div>
      </div>
    </section>
  );
}
