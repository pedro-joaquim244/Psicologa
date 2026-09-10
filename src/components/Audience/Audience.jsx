const topics = ['Ansiedade', 'Autoconhecimento', 'Relacionamentos', 'Mudanças de vida', 'Autoestima', 'Sobrecarga emocional', 'Dificuldades profissionais', 'Processos de decisão'];

export default function Audience() {
  return (
    <section className="audience-section section-space page-container" aria-labelledby="audience-title"><div className="row g-0 justify-content-between"><div className="col-lg-6"><SectionLabel number="09" data-reveal>PARA QUEM É</SectionLabel><h2 id="audience-title" className="display-title" data-reveal>Talvez seja hora de<br />olhar com mais<br />atenção para <em>você.</em></h2><p className="audience-description" data-reveal>A psicoterapia pode ajudar pessoas que estejam passando por momentos de:</p></div><div className="col-lg-5"><ul className="audience-list">{topics.map((topic, index) => <li key={topic} data-reveal><span className="audience-number">{String(index + 1).padStart(2, '0')}</span><span>{topic}</span><span className="audience-mark" aria-hidden="true">↗</span></li>)}</ul><p className="audience-footnote">Cada pessoa tem uma história. O cuidado começa ao reconhecer a sua.</p></div></div></section>
  );
}
import SectionLabel from '../Shared/SectionLabel';
