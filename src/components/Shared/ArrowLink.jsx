export default function ArrowLink({ children, href = '#contato', className = '', external = false, ...props }) {
  return (
    <a className={`arrow-link ${className}`} href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...props}>
      <span>{children}</span><i className="bi bi-arrow-up-right" aria-hidden="true" />
    </a>
  );
}
