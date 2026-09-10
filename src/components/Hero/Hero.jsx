import { useRef } from 'react';
import { images, site } from '../../config/site';
import { gsap, useScrollScene } from '../../lib/motion';
import ArrowLink from '../Shared/ArrowLink';
import CircularBadge from '../Shared/CircularBadge';
import FloralMark from '../Shared/FloralMark';
import '../../styles/hero.css';

function animateHero({ desktop, reduced }, root) {
  if (reduced) return;
  if (!desktop) {
    gsap.fromTo('.hero-photo img', { scale: 1.07 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.hero-photo', start: 'top 80%', end: 'bottom 20%', scrub: true } });
    return;
  }
  const photo = root.querySelector('.hero-photo');
  const timeline = gsap.timeline({ scrollTrigger: {
    id: 'hero-expand', trigger: root, start: 'top top', end: () => `+=${window.innerHeight * 1.45}`,
    scrub: 1, pin: true, anticipatePin: 1, invalidateOnRefresh: true,
  } });
  // Medidas sem transformações mantêm o cálculo estável ao redimensionar.
  timeline.to('.hero-copy', { y: -75, autoAlpha: 0, duration: 0.45, ease: 'none' }, 0)
    .to('.hero-meta, .photo-note, .hero-side-note, .hero-badge', { autoAlpha: 0, duration: 0.3 }, 0)
    .to(photo, {
      x: () => root.clientWidth / 2 - photo.offsetLeft - photo.offsetWidth / 2,
      y: () => root.clientHeight / 2 - photo.offsetTop - photo.offsetHeight / 2,
      scale: () => Math.max(root.clientWidth / photo.offsetWidth, root.clientHeight / photo.offsetHeight) * 1.015,
      duration: 1, ease: 'none',
    }, 0.08)
    .fromTo('.hero-photo img', { scale: 1.12 }, { scale: 1, duration: 1, ease: 'none' }, 0.08)
    .fromTo('.hero-photo-shade', { opacity: 0 }, { opacity: 0.3, duration: 0.5 }, 0.65)
    .fromTo('.hero-photo-message', { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.3 }, 1.08);
}

export default function Hero() {
  const ref = useRef(null);
  useScrollScene(ref, animateHero);
  return (
    <section id="inicio" ref={ref} className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow hero-eyebrow"><FloralMark /> PSICOLOGIA · ACOLHIMENTO · AUTOCONHECIMENTO</p>
        <h1 id="hero-title">Um espaço para<br />se escutar com<br /><em>mais calma.</em></h1>
        <p className="hero-description">A psicoterapia pode ser um espaço de pausa, compreensão e construção de novas possibilidades para sua vida.</p>
        <div className="hero-actions"><ArrowLink className="button button-dark">Agendar uma conversa</ArrowLink><a className="text-link" href="#sobre">Conheça meu trabalho <i className="bi bi-arrow-down" aria-hidden="true" /></a></div>
      </div>
      <figure className="hero-photo">
        <img src={images.hero.src} alt={images.hero.alt} fetchPriority="high" width="1600" height="1200" />
        <div className="hero-photo-shade" />
      </figure>
      <CircularBadge className="hero-badge" />
      <span className="photo-note">Um lugar de pausa. Um encontro com você.</span>
      <span className="hero-side-note" aria-hidden="true">PRESENÇA. ESCUTA. CUIDADO.</span>
      <div className="hero-photo-message" aria-hidden="true"><span className="eyebrow">SEU TEMPO. SEU ESPAÇO.</span><p>Você pode<br /><em>simplesmente ser.</em></p></div>
      <div className="hero-meta"><span>{site.crp} <span className="meta-divider">/</span> PRESENCIAL & ONLINE</span><a href="#processo">DESACELERE. CONTINUE A DESCOBRIR. <span className="scroll-circle"><i className="bi bi-arrow-down" aria-hidden="true" /></span></a><span className="hero-index">01 — 12</span></div>
    </section>
  );
}
