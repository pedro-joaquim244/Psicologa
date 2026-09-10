import SectionLabel from '../Shared/SectionLabel';
import '../../styles/process.css';

export default function Process() {
  return (
    <section id="processo" className="process-section page-container" aria-labelledby="process-title">
      <div className="process-top"><SectionLabel number="02">SOBRE O PROCESSO</SectionLabel><span className="eyebrow">ESCUTA É PRESENÇA.</span></div>
      <h2 id="process-title" className="display-title"><span data-line>Nem sempre precisamos</span><span data-line>ter <em>todas as respostas.</em></span></h2>
      <div className="process-bottom" data-reveal><span className="process-aside">Às vezes,</span><p>precisamos apenas de <em>um espaço seguro</em> para começar a fazer as perguntas certas.</p><span className="process-vertical eyebrow" aria-hidden="true">UM LUGAR PARA SUAS PERGUNTAS</span></div>
    </section>
  );
}
