import { useRef } from 'react';
import { gsap, useScrollScene } from '../../lib/motion';

function animateMarquee({ desktop, tablet, reduced }, root) {
  if (reduced) return;
  gsap.fromTo('.marquee-track', { xPercent: desktop ? 5 : 0 }, { xPercent: desktop ? -24 : tablet ? -16 : -9, ease: 'none', scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: 1, invalidateOnRefresh: true } });
}

export default function EditorialMarquee() {
  const ref = useRef(null);
  useScrollScene(ref, animateMarquee);
  return <div ref={ref} className="editorial-marquee" aria-hidden="true"><div className="marquee-track">Escutar<span>·</span><em>compreender</em><span>·</span>continuar<span>·</span></div></div>;
}
