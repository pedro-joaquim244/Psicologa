export default function SectionLabel({ number, children, className = '', ...props }) {
  return <p className={`eyebrow section-label ${className}`} {...props}><span className="section-number">{number}</span><span className="label-rule" aria-hidden="true" /><span>{children}</span></p>;
}
