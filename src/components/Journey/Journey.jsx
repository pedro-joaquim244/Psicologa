import { useRef } from 'react';
import { gsap, useScrollScene } from '../../lib/motion';
import SectionLabel from '../Shared/SectionLabel';
import '../../styles/journey.css';

// As coordenadas acompanham os cinco marcos do SVG. Os rótulos ficam em uma
// linha editorial comum abaixo da curva, ligados aos pontos por fios discretos.
const moments = [
  { title: 'Início', x: 10, y: 112 },
  { title: 'Escuta', x: 30, y: 60 },
  { title: 'Compreensão', x: 50, y: 128 },
  { title: 'Autoconhecimento', x: 70, y: 62 },
  { title: 'Continuidade', x: 90, y: 102 },
];

function animateJourney({ desktop, reduced }, root) {
  if (reduced) return;
  const paths = root.querySelectorAll('.journey-drawing');
  gsap.timeline({ scrollTrigger: { trigger: root, start: 'top 70%', end: desktop ? 'bottom 65%' : 'bottom 85%', scrub: 1 } })
    .fromTo(paths, { strokeDasharray: (_, path) => path.getTotalLength(), strokeDashoffset: (_, path) => path.getTotalLength() }, { strokeDashoffset: 0, duration: 1, ease: 'none' })
    .from('.journey-copy', { opacity: .55, y: 8, stagger: .16, duration: .3, ease: 'none' }, 0)
    .from('.journey-dot', { opacity: .45, stagger: .16, duration: .3, ease: 'none' }, 0);
}

export default function Journey() {
  const ref = useRef(null);
  useScrollScene(ref, animateJourney);
  return (
    <section id="percurso" ref={ref} className="journey-section section-space" aria-labelledby="journey-title">
      <div className="page-container">
        <div className="journey-intro"><SectionLabel number="05">O CAMINHO SE FAZ AO CAMINHAR</SectionLabel><h2 id="journey-title" className="display-title" data-reveal>Cada percurso tem<br /><em>o seu desenho.</em></h2><p>Não existe uma linha reta, nem um tempo igual para todos. Existe a possibilidade de caminhar com mais presença.</p></div>
        <div className="journey-map">
          <svg className="journey-desktop-line" viewBox="0 0 1200 250" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path className="journey-guide" d="M120 112C220 112 250 40 360 60S480 160 600 128S760 38 840 62C930 62 1005 130 1080 102" /><path className="journey-drawing" d="M120 112C220 112 250 40 360 60S480 160 600 128S760 38 840 62C930 62 1005 130 1080 102" /></svg>
          <svg className="journey-mobile-line" viewBox="0 0 48 520" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path className="journey-guide" d="M24 42C46 76 2 112 24 146S46 216 24 250S2 320 24 354S46 424 24 458" /><path className="journey-drawing" d="M24 42C46 76 2 112 24 146S46 216 24 250S2 320 24 354S46 424 24 458" /></svg>
          <ol className="journey-moments">
            {moments.map((moment, index) => (
              <li
                className="journey-moment"
                style={{ '--journey-x': `${moment.x}%`, '--journey-y': `${moment.y}px` }}
                key={moment.title}
              >
                <span className="journey-dot" aria-hidden="true" />
                <span className="journey-copy">
                  <span className="eyebrow">0{index + 1}</span>
                  <span className="journey-title">{moment.title}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="journey-note">Um processo vivo. Com espaço para descobertas, pausas e recomeços.</p>
      </div>
    </section>
  );
}
