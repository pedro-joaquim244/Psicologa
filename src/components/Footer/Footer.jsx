import { site, whatsappUrl } from '../../config/site';
import { Link } from 'react-router-dom';
import '../../styles/footer.css';

export default function Footer() {
  return (
    <footer className="site-footer"><div className="page-container"><div className="footer-main"><a href="#inicio" className="footer-brand"><small className="eyebrow">PSICOLOGIA & ESCUTA</small><span>{site.shortName.split(' ').map((name) => <span key={name}>{name}</span>)}</span><small>{site.profession}</small></a><div className="footer-links"><p className="eyebrow">VAMOS CONVERSAR</p><a href={site.instagramUrl} target="_blank" rel="noopener noreferrer">Instagram <i className="bi bi-arrow-up-right" aria-hidden="true" /></a><a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">WhatsApp <i className="bi bi-arrow-up-right" aria-hidden="true" /></a><a href={`mailto:${site.email}`}>E-mail <i className="bi bi-arrow-up-right" aria-hidden="true" /></a></div><nav className="footer-links" aria-label="Navegação do rodapé"><p className="eyebrow">EXPLORE</p><a href="#sobre">Sobre</a><a href="#atendimento">Atendimento</a><a href="#faq">FAQ</a><a href="#contato">Contato</a></nav><a href="#inicio" className="back-top" aria-label="Voltar ao início"><i className="bi bi-arrow-up" aria-hidden="true" /></a></div><div className="footer-location"><span>{site.crp}</span><span>{site.location}</span></div><div className="footer-bottom"><span>© {new Date().getFullYear()} {site.shortName}. Todos os direitos reservados.</span><Link className="professional-link" to="/adm/login">Área profissional</Link><span>FEITO DE ESCUTA, PRESENÇA E CUIDADO.</span></div></div></footer>
  );
}
