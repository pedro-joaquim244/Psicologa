import { useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

// Cada componente possui seu próprio contexto e desfaz efeitos ao desmontar
// ou mudar de breakpoint. Conteúdo está visível por padrão, inclusive sem motion.
export function useScrollScene(ref, setup) {
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const media = gsap.matchMedia();
      media.add({
        desktop: '(min-width: 1024px) and (min-height: 650px)',
        tablet: '(min-width: 651px) and (max-width: 1023px) and (min-height: 650px)',
        mobile: '(max-width: 650px), (max-height: 649px)',
        reduced: '(prefers-reduced-motion: reduce)',
      }, (context) => setup(context.conditions, ref.current));
    }, ref);
    return () => ctx.revert();
  }, [ref, setup]);
}
