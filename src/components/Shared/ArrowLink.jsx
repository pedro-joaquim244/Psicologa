import SectionLink from './SectionLink';

export default function ArrowLink({ children, href = '#agendamento', className = '', external = false, ...props }) {
  if (!external && href.startsWith('#')) {
    return <SectionLink section={href.slice(1)} className={`arrow-link ${className}`} {...props}>
      <span>{children}</span><i className="bi bi-arrow-up-right" aria-hidden="true" />
    </SectionLink>;
  }
  return (
    <a className={`arrow-link ${className}`} href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...props}>
      <span>{children}</span><i className="bi bi-arrow-up-right" aria-hidden="true" />
    </a>
  );
}
