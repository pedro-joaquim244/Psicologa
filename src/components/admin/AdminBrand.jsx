import { Link } from "react-router-dom";
import { site } from "../../config/site";

export default function AdminBrand({ compact = false }) {
  return (
    <Link to="/" className={`admin-brand ${compact ? "is-compact" : ""}`} aria-label={`${site.name}, voltar ao site`}>
      <span className="admin-monogram" aria-hidden="true">h<span>m</span></span>
      <span className="admin-brand-copy"><strong>{site.name}</strong><small>PSICOLOGIA & ESCUTA</small></span>
    </Link>
  );
}
