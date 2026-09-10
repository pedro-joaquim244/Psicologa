import '../../styles/manifesto.css';

export default function Manifesto() {
  return (
    <section className="manifesto-section" aria-labelledby="manifesto-title"><div className="page-container"><div className="manifesto-top"><SectionLabel number="10">UM CONVITE</SectionLabel><FloralMark /></div><h2 id="manifesto-title"><span data-line>Você não precisa saber</span><span data-line>exatamente <em>por onde</em></span><span data-line><em>começar.</em></span></h2><div className="manifesto-bottom" data-reveal><span className="manifesto-line" /><p>Podemos descobrir isso juntos.</p><span className="eyebrow">COM TEMPO. COM CUIDADO.</span></div></div></section>
  );
}
import SectionLabel from '../Shared/SectionLabel';
import FloralMark from '../Shared/FloralMark';
