import { useEffect, useRef, useState } from 'react';
import { ScrollTrigger } from '../../lib/motion';
import SectionLabel from '../Shared/SectionLabel';
import '../../styles/faq.css';

const questions = [
  ['Como funciona a primeira sessão?', 'É um primeiro encontro para nos conhecermos. Você pode compartilhar o que motivou sua busca, falar sobre suas expectativas e tirar dúvidas sobre o processo. Não é preciso preparar um roteiro: a conversa acontece no seu ritmo.'],
  ['Quanto tempo dura uma sessão?', 'Em geral, as sessões têm duração aproximada de 50 minutos. Os detalhes de duração e formato são combinados no contato inicial, de acordo com o atendimento.'],
  ['O atendimento pode ser online?', 'Sim. O atendimento online acontece por videochamada, em horário previamente combinado. Você precisará de uma conexão estável e de um espaço reservado, onde se sinta à vontade para conversar.'],
  ['Com qual frequência acontecem as sessões?', 'Os encontros costumam ser semanais, mas a frequência é conversada e definida em conjunto, considerando suas necessidades e as particularidades do processo.'],
  ['Como faço para agendar?', 'Basta entrar em contato pelo WhatsApp no botão “Agendar pelo WhatsApp”. Nesse primeiro contato, conversamos sobre disponibilidade, valores e funcionamento das sessões, e você pode esclarecer suas dúvidas.'],
];

export default function FAQ() {
  const [opened, setOpened] = useState(0);
  const buttonRefs = useRef([]);

  useEffect(() => {
    // A resposta altera a posição do contato e dos seus reveals.
    const frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(frame);
  }, [opened]);

  const navigateQuestions = (event, index) => {
    const destinations = { ArrowDown: (index + 1) % questions.length, ArrowUp: (index - 1 + questions.length) % questions.length, Home: 0, End: questions.length - 1 };
    if (!(event.key in destinations)) return;
    event.preventDefault();
    buttonRefs.current[destinations[event.key]]?.focus();
  };
  return (
    <section id="faq" className="faq-section section-space page-container" aria-labelledby="faq-title">
      <div className="row g-0 justify-content-between">
        <div className="col-lg-5">
          <SectionLabel number="11" data-reveal>DÚVIDAS FREQUENTES</SectionLabel>
          <h2 id="faq-title" className="display-title" data-reveal>Antes de começar,<br />algumas dúvidas<br />são <em>naturais.</em></h2>
          <p className="faq-intro" data-reveal>Conhecer o processo também<br />faz parte de se sentir à vontade.</p>
        </div>
        <div className="col-lg-6 faq-list">
          {questions.map(([question, answer], index) => (
            <div key={question} className={`faq-item ${opened === index ? 'is-open' : ''}`}>
              <h3>
                <button ref={(element) => { buttonRefs.current[index] = element; }} type="button" id={`faq-question-${index}`} aria-expanded={opened === index} aria-controls={`faq-answer-${index}`} onKeyDown={(event) => navigateQuestions(event, index)} onClick={() => setOpened(opened === index ? null : index)}>
                  <span className="faq-number">0{index + 1}</span><span>{question}</span>
                  <i className="bi bi-plus-lg faq-plus" aria-hidden="true" />
                </button>
              </h3>
              <div id={`faq-answer-${index}`} role="region" aria-labelledby={`faq-question-${index}`} className="faq-answer" hidden={opened !== index}><p>{answer}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
