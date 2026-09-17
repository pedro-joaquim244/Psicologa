import { useEffect } from 'react';
import Navbar from '../Navbar/Navbar';
import Footer from '../Footer/Footer';
import SectionLink from '../Shared/SectionLink';
import '../../styles/patient.css';

export default function PatientLayout({ label, title, description, children }) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${label} | Dra. Helena Martins`;
    window.scrollTo({ top: 0, behavior: 'instant' });
    return () => { document.title = previous; };
  }, [label]);

  return <>
    <Navbar />
    <main id="conteudo" className="patient-page page-container" tabIndex={-1}>
      <div className="patient-intro">
        <div><p className="eyebrow section-label"><span className="label-rule" aria-hidden="true" />{label}</p><h1 className="display-title">{title}</h1></div>
        <div className="patient-intro-note"><p>{description}</p><SectionLink section="agendamento" className="text-link">Agendar uma conversa <i className="bi bi-arrow-up-right" aria-hidden="true" /></SectionLink></div>
      </div>
      {children}
    </main>
    <Footer />
  </>;
}
