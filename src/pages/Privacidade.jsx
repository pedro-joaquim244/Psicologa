import { useEffect } from 'react';
import { site } from '../config/site';
import Navbar from '../components/Navbar/Navbar';
import Footer from '../components/Footer/Footer';
import SectionLink from '../components/Shared/SectionLink';
import '../styles/patient.css';

export default function Privacidade() {
  useEffect(() => {
    const previous = document.title;
    document.title = `Privacidade | ${site.shortName}`;
    return () => { document.title = previous; };
  }, []);

  return <>
    <Navbar />
    <main id="conteudo" className="patient-page page-container privacy-page" tabIndex={-1}>
      <div className="patient-intro">
        <div><p className="eyebrow section-label"><span className="label-rule" aria-hidden="true" />PRIVACIDADE</p><h1 className="display-title">Seus dados,<br /><em>com cuidado.</em></h1></div>
        <div className="patient-intro-note"><p>Este aviso explica como os dados enviados pelo site são usados para criar a conta e organizar os atendimentos.</p><SectionLink section="agendamento" className="text-link">Agendar uma conversa <i className="bi bi-arrow-up-right" aria-hidden="true" /></SectionLink></div>
      </div>
      <div className="privacy-content">
        <section aria-labelledby="privacy-data"><h2 id="privacy-data">Dados utilizados</h2><p>O cadastro reúne nome, e-mail e WhatsApp. O agendamento registra a modalidade, data e horário escolhidos. O site não solicita informações clínicas, relatos ou prontuários.</p></section>
        <section aria-labelledby="privacy-purpose"><h2 id="privacy-purpose">Para que servem</h2><p>Esses dados permitem identificar sua conta, confirmar o e-mail, reservar horários e entrar em contato sobre o atendimento. Outros pacientes não têm acesso às suas informações.</p></section>
        <section aria-labelledby="privacy-security"><h2 id="privacy-security">Acesso e proteção</h2><p>O acesso à área do paciente exige conta confirmada por e-mail. Senhas não ficam armazenadas no navegador. Dados de conta e agendamentos são acessíveis somente pela sessão autenticada correspondente.</p></section>
        <section aria-labelledby="privacy-retention"><h2 id="privacy-retention">Conservação e solicitações</h2><p>Os dados são mantidos pelo tempo necessário para operar a conta, organizar os atendimentos e cumprir obrigações aplicáveis. Para pedir acesso, correção ou exclusão de dados, use os canais oficiais informados durante o contato sobre o atendimento{site.email && <> ou escreva para <a href={`mailto:${site.email}`}>{site.email}</a></>}.</p></section>
        <section aria-labelledby="privacy-updates"><h2 id="privacy-updates">Atualizações</h2><p>Este aviso pode ser ajustado quando o funcionamento do site mudar. A versão mais recente permanece sempre nesta página.</p></section>
      </div>
    </main>
    <Footer />
  </>;
}
