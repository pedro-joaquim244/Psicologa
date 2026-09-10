import { useRef } from 'react';
import { gsap, useScrollScene } from '../../lib/motion';
import Botanical from '../Shared/Botanical';
import FloralMark from '../Shared/FloralMark';
import SectionLabel from '../Shared/SectionLabel';
import '../../styles/reflection.css';

function animateReflection({ desktop, tablet, reduced }, root) {
  if (reduced) return;
  const colors = getComputedStyle(root);
  const timeline = gsap.timeline({ scrollTrigger: { trigger: root, start: 'top 85%', end: 'center 55%', scrub: 1 } });
  timeline.fromTo(root, { backgroundColor: colors.getPropertyValue('--color-background').trim() }, { backgroundColor: colors.getPropertyValue('--color-blue').trim(), duration: 1, ease: 'none' })
    .from('.reflection-title > span', { y: desktop ? 38 : 16, opacity: .35, stagger: .12, duration: .6 }, 0);
  if (desktop || tablet) gsap.fromTo('[data-botanical]', { yPercent: 8 }, { yPercent: -10, stagger: .1, ease: 'none', scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: 1 } });
}

export default function Reflection() {
  const ref = useRef(null);
  useScrollScene(ref, animateReflection);
  return (
    <section ref={ref} className="reflection-section" aria-labelledby="reflection-title">
      <Botanical className="reflection-branch branch-left" /><Botanical className="reflection-branch branch-right" />
      <div className="page-container reflection-content"><SectionLabel number="06">O QUE ENCONTRA ESPAÇO EM VOCÊ</SectionLabel><h2 id="reflection-title" className="reflection-title"><span>A escuta pode abrir</span><span>espaço para aquilo</span><span>que ainda não conseguimos</span><span><em>nomear.</em></span></h2><FloralMark /><p className="eyebrow">NEM TUDO PRECISA VIR PRONTO.</p></div>
    </section>
  );
}
