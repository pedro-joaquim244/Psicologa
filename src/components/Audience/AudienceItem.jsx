import { useId, useLayoutEffect, useRef } from 'react';
import { gsap, ScrollTrigger } from '../../lib/motion';

export default function AudienceItem({ topic, index, opened, buttonRef, onToggle, onKeyDown }) {
  const id = useId();
  const panelRef = useRef(null);
  const initialized = useRef(false);

  useLayoutEffect(() => {
    // O estado inicial fechado vem do CSS e não precisa de animação.
    if (!initialized.current && !opened) { initialized.current = true; return; }
    initialized.current = true;
    const panel = panelRef.current;
    const copy = panel.firstElementChild;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animation;
    const animate = () => {
      animation?.kill();
      if (preference.matches) {
        gsap.set(panel, { height: opened ? 'auto' : 0, autoAlpha: opened ? 1 : 0 });
        gsap.set(copy, { y: 0, opacity: 1 });
        ScrollTrigger.refresh(true);
        return;
      }
      animation = gsap.timeline({ onComplete: () => ScrollTrigger.refresh(true) })
        .to(panel, { height: opened ? 'auto' : 0, autoAlpha: opened ? 1 : 0, duration: .36, ease: 'power2.inOut' }, 0)
        .to(copy, { y: opened ? 0 : -4, opacity: opened ? 1 : 0, duration: .24, ease: 'power2.out' }, opened ? .06 : 0);
    };
    animate();
    preference.addEventListener('change', animate);
    return () => { animation?.kill(); preference.removeEventListener('change', animate); };
  }, [opened]);

  return (
    <li className={`audience-item${opened ? ' is-open' : ''}`} data-reveal>
      <h3>
        <button ref={buttonRef} type="button" className="audience-trigger" id={`audience-trigger-${id}`}
          aria-expanded={opened} aria-controls={`audience-panel-${id}`} onClick={onToggle} onKeyDown={onKeyDown}>
          <span className="audience-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <span className="audience-topic">{topic.title}</span>
          <span className="audience-mark" aria-hidden="true"><span className="audience-arrow">↗</span><span className="audience-close">×</span></span>
        </button>
      </h3>
      <div ref={panelRef} id={`audience-panel-${id}`} role="region" aria-labelledby={`audience-trigger-${id}`}
        className="audience-panel" aria-hidden={!opened} inert={!opened}>
        <p>{topic.description}</p>
      </div>
    </li>
  );
}
