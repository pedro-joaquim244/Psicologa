import { useRef } from 'react';
import { images } from '../../config/site';
import { gsap, useScrollScene } from '../../lib/motion';
import Photo from '../Shared/Photo';
import SectionLabel from '../Shared/SectionLabel';

function animateImage({ desktop, reduced }, root) {
  if (reduced) return;
  gsap.fromTo('.immersive-photo', { clipPath: desktop ? 'inset(9% 7% 9% 7%)' : 'inset(3% 5% 3% 5%)' }, {
    clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
    scrollTrigger: { trigger: root, start: 'top 80%', end: 'top 5%', scrub: 1 },
  });
  gsap.fromTo('.immersive-photo img', { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: 1 } });
  if (desktop) gsap.fromTo('.immersive-words span', { y: 45, opacity: 0.25 }, { y: 0, opacity: 1, stagger: 0.18, ease: 'none', scrollTrigger: { trigger: root, start: 'top 55%', end: 'top 5%', scrub: 1 } });
}

export default function Immersive() {
  const ref = useRef(null);
  useScrollScene(ref, animateImage);
  return (
    <section ref={ref} className="immersive-section" aria-label="Uma pausa para respirar">
      <div className="immersive-photo"><Photo image={images.nature} sizes="100vw" /><div className="immersive-shade" /><div className="immersive-copy"><SectionLabel number="08">PERMITA-SE UMA PAUSA</SectionLabel><p className="immersive-words"><span>Respirar.</span><span><em>Compreender.</em></span><span>Continuar.</span></p><span className="immersive-note">UM PASSO DE CADA VEZ.</span></div></div>
    </section>
  );
}
