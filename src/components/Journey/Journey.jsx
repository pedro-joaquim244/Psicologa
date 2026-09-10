import { useRef } from 'react';
import { gsap, useScrollScene } from '../../lib/motion';
import SectionLabel from '../Shared/SectionLabel';
import '../../styles/journey.css';

const moments = ['Início', 'Escuta', 'Compreensão', 'Autoconhecimento', 'Continuidade'];

function animateJourney({ desktop, reduced }, root) {
  if (reduced) return;
  const paths = root.querySelectorAll('.journey-drawing');
  gsap.timeline({ scrollTrigger: { trigger: root, start: 'top 70%', end: desktop ? 'bottom 65%' : 'bottom 85%', scrub: 1 } })
    .fromTo(paths, { strokeDasharray: (_, path) => path.getTotalLength(), strokeDashoffset: (_, path) => path.getTotalLength() }, { strokeDashoffset: 0, duration: 1, ease: 'none' })
    .from('.journey-moment', { opacity: .25, y: 12, stagger: .16, duration: .3, ease: 'none' }, 0);
}

export default function Journey() {
  const ref = useRef(null);
  useScrollScene(ref, animateJourney);
  return (
    <section id="percurso" ref={ref} className="journey-section section-space" aria-labelledby="journey-title">
      <div className="page-container">
        <div className="journey-intro"><SectionLabel number="05">O CAMINHO SE FAZ AO CAMINHAR</SectionLabel><h2 id="journey-title" className="display-title" data-reveal>Cada percurso tem<br /><em>o seu desenho.</em></h2><p>Não existe uma linha reta, nem um tempo igual para todos. Existe a possibilidade de caminhar com mais presença.</p></div>
        <div className="journey-map">
          <svg className="journey-desktop-line" viewBox="0 0 1200 250" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path className="journey-guide" d="M120 140C220 140 250 35 360 65S480 235 600 170S740 8 840 68S990 208 1080 110" /><path className="journey-drawing" d="M120 140C220 140 250 35 360 65S480 235 600 170S740 8 840 68S990 208 1080 110" /></svg>
          <svg className="journey-mobile-line" viewBox="0 0 48 560" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path className="journey-guide" d="M24 42C46 80 2 116 24 154S46 228 24 266S2 340 24 378S46 452 24 490" /><path className="journey-drawing" d="M24 42C46 80 2 116 24 154S46 228 24 266S2 340 24 378S46 452 24 490" /></svg>
          <ol className="journey-moments">{moments.map((moment, index) => <li className={`journey-moment moment-${index}`} key={moment}><span className="journey-dot" aria-hidden="true" /><span className="eyebrow">0{index + 1}</span><span>{moment}</span></li>)}</ol>
        </div>
        <p className="journey-note">Um processo vivo. Com espaço para descobertas, pausas e recomeços.</p>
      </div>
    </section>
  );
}
