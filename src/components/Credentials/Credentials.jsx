import { site } from '../../config/site';

export default function Credentials() {
  const credentials = [['Formação', site.education], ['Atuação', site.profession], ['Modalidade', 'Online / Presencial'], ['Registro', site.crp]];
  return (
    <section className="credentials-section page-container" aria-label="Informações profissionais">
      <dl className="credentials-list">{credentials.map(([label, value]) => <div key={label}><dt className="eyebrow">{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>
  );
}
