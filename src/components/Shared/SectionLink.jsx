import { Link, useLocation } from 'react-router-dom';

export default function SectionLink({ section, children, ...props }) {
  const { pathname } = useLocation();
  return pathname === '/'
    ? <a href={`#${section}`} {...props}>{children}</a>
    : <Link to={`/#${section}`} {...props}>{children}</Link>;
}
