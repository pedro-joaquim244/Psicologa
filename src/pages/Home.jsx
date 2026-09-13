import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar/Navbar';
import Hero from '../components/Hero/Hero';
import Process from '../components/Process/Process';
import About from '../components/About/About';
import Approach from '../components/Approach/Approach';
import Services from '../components/Services/Services';
import Immersive from '../components/Immersive/Immersive';
import Audience from '../components/Audience/Audience';
import Manifesto from '../components/Manifesto/Manifesto';
import FAQ from '../components/FAQ/FAQ';
import CTA from '../components/CTA/CTA';
import Footer from '../components/Footer/Footer';
import MobileContact from '../components/MobileContact/MobileContact';
import EditorialMarquee from '../components/EditorialMarquee/EditorialMarquee';
import Credentials from '../components/Credentials/Credentials';
import Journey from '../components/Journey/Journey';
import Reflection from '../components/Reflection/Reflection';
import Scheduling from '../components/Scheduling/Scheduling';
import { gsap, ScrollTrigger, useScrollScene } from '../lib/motion';

function animatePage({ desktop, reduced }, root) {
  if (reduced) return;
  // Um reveal agrupado por composição, em vez de um ScrollTrigger por texto.
  gsap.utils.toArray('main section', root).forEach((section) => {
    const elements = section.querySelectorAll('[data-reveal]');
    if (elements.length) gsap.from(elements, { y: desktop ? 24 : 12, opacity: 0, stagger: .07, duration: .8, ease: 'power2.out', scrollTrigger: { trigger: section, start: 'top 86%', once: true } });
  });
  gsap.utils.toArray('.process-section, .manifesto-section', root).forEach((section) => {
    gsap.from(section.querySelectorAll('[data-line]'), { y: desktop ? 45 : 16, x: (index) => desktop ? (index % 2 ? 24 : -24) : 0, opacity: .25, stagger: .2, ease: 'none', scrollTrigger: { trigger: section, start: 'top 78%', end: 'center 55%', scrub: 1 } });
  });
  gsap.utils.toArray('[data-image-reveal]', root).forEach((element) => {
    gsap.fromTo(element, { clipPath: 'inset(10% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', ease: 'none', scrollTrigger: { trigger: element, start: 'top 90%', end: 'top 35%', scrub: 1 } });
  });
  gsap.utils.toArray('[data-badge-ring]', root).forEach((element) => {
    gsap.to(element, { rotation: desktop ? 100 : 30, transformOrigin: '50% 50%', ease: 'none', scrollTrigger: { trigger: element.closest('section'), start: 'top bottom', end: 'bottom top', scrub: 1 } });
  });
}

export default function Home() {
  const ref = useRef(null);
  const { hash } = useLocation();
  useScrollScene(ref, animatePage);
  useEffect(() => {
    let disposed = false;
    let frame;
    const refresh = () => { if (!disposed) ScrollTrigger.refresh(); };
    const restoreAnchor = () => {
      refresh();
      const hash = window.location.hash;
      if (hash) {
        let id;
        try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
        document.getElementById(id)?.scrollIntoView({ behavior: 'instant' });
      }
    };
    document.fonts.ready.then(() => { if (!disposed) frame = requestAnimationFrame(restoreAnchor); });
    window.addEventListener('load', refresh);
    return () => { disposed = true; cancelAnimationFrame(frame); window.removeEventListener('load', refresh); };
  }, [hash]);
  return (
    <div ref={ref}>
      <Navbar />
      <main id="conteudo" tabIndex={-1}>
        <Hero /><Process /><EditorialMarquee /><About /><Credentials />
        <Approach /><Journey /><Reflection /><Services /><Immersive />
        <Audience /><Manifesto /><FAQ /><Scheduling /><CTA />
      </main>
      <Footer /><MobileContact />
    </div>
  );
}
