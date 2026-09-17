import { site, whatsappUrl } from '../../config/site';
import { Link } from 'react-router-dom';
import SectionLink from '../Shared/SectionLink';
import '../../styles/footer.css';

export default function Footer() {
  return (
    <footer className="site-footer"><div className="page-container"><div className="footer-main"><SectionLink section="inicio" className="footer-brand"><small className="eyebrow">PSICOLOGIA & ESCUTA</small><span>{site.shortName.split(' ').map((name) => <span key={name}>{name}</span>)}</span><small>{site.profession}</small></SectionLink><div className="footer-links"><p className="eyebrow">VAMOS CONVERSAR</p><a href={site.instagramUrl} target="_blank" rel="noopener noreferrer">Instagram <i className="bi bi-arrow-up-right" aria-hidden="true" /></a><a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">WhatsApp <i className="bi bi-arrow-up-right" aria-hidden="true" /></a><a href={`mailto:${site.email}`}>E-mail <i className="bi bi-arrow-up-right" aria-hidden="true" /></a></div><nav className="footer-links" aria-label="Navegação do rodapé"><p className="eyebrow">EXPLORE</p><SectionLink section="sobre">Sobre</SectionLink><SectionLink section="atendimento">Atendimento</SectionLink><SectionLink section="faq">FAQ</SectionLink><SectionLink section="contato">Contato</SectionLink></nav><SectionLink section="inicio" className="back-top" aria-label="Voltar ao início"><i className="bi bi-arrow-up" aria-hidden="true" /></SectionLink></div><div className="footer-location"><span>{site.crp}</span><span>{site.location}</span></div><div className="footer-bottom"><span>© {new Date().getFullYear()} {site.shortName}. Todos os direitos reservados.</span><Link className="professional-link" to="/adm/login">Área profissional</Link><span>FEITO DE ESCUTA, PRESENÇA E CUIDADO.</span></div></div></footer>
  );
}
