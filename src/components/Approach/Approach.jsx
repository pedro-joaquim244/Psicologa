import { useRef } from 'react';
import { images } from '../../config/site';
import { ScrollTrigger, useScrollScene } from '../../lib/motion';
import SectionLabel from '../Shared/SectionLabel';
import '../../styles/approach.css';

const steps = [
  { title: 'Escuta', text: 'Um espaço para falar livremente e compreender o que está acontecendo.', note: 'SUA HISTÓRIA TEM LUGAR AQUI.', image: images.hero },
  { title: 'Compreensão', text: 'Identificamos padrões, sentimentos e questões importantes da sua história.', note: 'NOVOS OLHARES PARA O QUE VOCÊ SENTE.', image: images.detail },
  { title: 'Construção', text: 'Desenvolvemos novas formas de lidar com situações, relações e emoções.', note: 'POSSIBILIDADES QUE FAZEM SENTIDO PARA VOCÊ.', image: images.nature },
];

function animateApproach({ desktop, reduced }, root) {
  if (!desktop || reduced) return;
  const items = [...root.querySelectorAll('.approach-step')];
  const photos = [...root.querySelectorAll('.approach-image')];
  const indicators = [...root.querySelectorAll('.approach-indicator')];
  const counter = root.querySelector('.approach-current');
  const caption = root.querySelector('.approach-image-label');
  root.classList.add('story-enabled');
  const activate = (index) => {
    items.forEach((item, i) => item.classList.toggle('is-active', i === index));
    photos.forEach((photo, i) => photo.classList.toggle('is-active', i === index));
    indicators.forEach((indicator, i) => indicator.classList.toggle('is-active', i === index));
    counter.textContent = `0${index + 1}`;
    caption.textContent = steps[index].note;
  };
  items.forEach((item, index) => ScrollTrigger.create({
    trigger: item, start: 'top 56%', end: 'bottom 56%',
    onEnter: () => activate(index), onEnterBack: () => activate(index),
  }));
  return () => { activate(0); root.classList.remove('story-enabled'); };
}

export default function Approach() {
  const ref = useRef(null);
  useScrollScene(ref, animateApproach);
  return (
    <section id="abordagem" ref={ref} className="approach-section section-space" aria-labelledby="approach-title">
      <div className="page-container approach-grid">
        <div className="approach-sticky"><SectionLabel number="04">MEU OLHAR SOBRE A TERAPIA</SectionLabel><h2 id="approach-title" className="display-title">Um processo<br />construído no<br /><em>seu ritmo.</em></h2><div className="approach-images" aria-hidden="true">{steps.map((step, index) => <img key={step.title} className={`approach-image ${index === 0 ? 'is-active' : ''}`} src={step.image.src} alt="" width="800" height="600" loading="lazy" />)}<span className="approach-image-label">{steps[0].note}</span></div><div className="approach-progress" aria-hidden="true"><span><span className="approach-current">01</span> / 03</span><div>{steps.map((step, index) => <span key={step.title} className={`approach-indicator ${index === 0 ? 'is-active' : ''}`} />)}</div></div></div>
        <div className="approach-steps">{steps.map((step, index) => <article className={`approach-step ${index === 0 ? 'is-active' : ''}`} key={step.title}><span className="step-number">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.text}</p><span className="eyebrow step-note">{step.note}</span></div><i className="bi bi-arrow-down-right" aria-hidden="true" /></article>)}</div>
      </div>
    </section>
  );
}
