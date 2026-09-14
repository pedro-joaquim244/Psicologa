import { useRef, useState } from 'react';
import SectionLabel from '../Shared/SectionLabel';
import ArrowLink from '../Shared/ArrowLink';
import AudienceItem from './AudienceItem';

const topics = [
  { title: 'Ansiedade', description: 'Preocupações frequentes, tensão e dificuldade de desacelerar. A psicoterapia pode ajudar a compreender esses padrões e construir novas formas de lidar com eles.' },
  { title: 'Autoconhecimento', description: 'Um espaço para compreender melhor emoções, comportamentos, escolhas e padrões que fazem parte da sua história.' },
  { title: 'Relacionamentos', description: 'Compreender vínculos, limites, conflitos e formas de se relacionar consigo e com outras pessoas.' },
  { title: 'Mudanças de vida', description: 'Acolhimento durante transições, perdas, recomeços e novos ciclos que podem gerar insegurança ou desconforto.' },
  { title: 'Autoestima', description: 'Um processo de reconstrução da forma como você se percebe, se valoriza e se posiciona nas relações e na vida.' },
  { title: 'Sobrecarga emocional', description: 'Quando responsabilidades, sentimentos e cobranças parecem difíceis de sustentar sozinha.' },
  { title: 'Dificuldades profissionais', description: 'Questões relacionadas ao trabalho, cobranças, inseguranças, decisões, mudanças de carreira e propósito.' },
  { title: 'Processos de decisão', description: 'Um espaço para organizar pensamentos, compreender possibilidades e tomar decisões com mais clareza.' },
];

export default function Audience() {
  const [opened, setOpened] = useState(null);
  const buttons = useRef([]);
  const navigateTopics = (event, index) => {
    const destinations = { ArrowDown: (index + 1) % topics.length, ArrowUp: (index - 1 + topics.length) % topics.length, Home: 0, End: topics.length - 1 };
    if (!(event.key in destinations)) return;
    event.preventDefault();
    buttons.current[destinations[event.key]]?.focus();
  };

  return (
    <section className="audience-section section-space page-container" aria-labelledby="audience-title">
      <div className="row g-0 justify-content-between">
        <div className="col-lg-6">
          <SectionLabel number="09" data-reveal>PARA QUEM É</SectionLabel>
          <h2 id="audience-title" className="display-title" data-reveal>Talvez seja hora de<br />olhar com mais<br />atenção para <em>você.</em></h2>
          <p className="audience-description" data-reveal>A psicoterapia pode ajudar pessoas que estejam passando por momentos de:</p>
        </div>
        <div className="col-lg-5">
          <ul className="audience-list">
            {topics.map((topic, index) => <AudienceItem key={topic.title} topic={topic} index={index} opened={opened === index}
              buttonRef={element => { buttons.current[index] = element; }}
              onToggle={() => setOpened(current => current === index ? null : index)}
              onKeyDown={event => navigateTopics(event, index)} />)}
          </ul>
          <p className="audience-footnote">Cada pessoa tem uma história. O cuidado começa ao reconhecer a sua.</p>
          <ArrowLink href="#agendamento" className="text-link audience-cta">Agendar uma conversa</ArrowLink>
        </div>
      </div>
    </section>
  );
}
