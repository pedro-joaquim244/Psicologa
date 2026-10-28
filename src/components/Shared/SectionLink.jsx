import { Link } from 'react-router-dom';

export default function SectionLink({ section, children, ...props }) {
  return <Link to={`/#${section}`} {...props}>{children}</Link>;
}
