import { STATUS_META } from "../../utils/adminFormatters";

const statuses = ["todos", ...Object.keys(STATUS_META)];

export default function AgendaFilters({ filters, onChange, resultCount }) {
  const update = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <section className="agenda-filters" aria-labelledby="filters-title">
      <div className="filter-heading">
        <div><span className="admin-kicker">FILTRAR AGENDA</span><h2 id="filters-title">Encontre um atendimento</h2></div>
        <p className="filter-count" aria-live="polite">{resultCount} {resultCount === 1 ? "resultado" : "resultados"}</p>
      </div>

      <div className="status-tabs" aria-label="Filtrar por status">
        {statuses.map((status) => (
          <button key={status} type="button" className={filters.status === status ? "is-active" : ""} aria-pressed={filters.status === status} onClick={() => update("status", status)}>
            {status === "todos" ? "Todos" : STATUS_META[status].label}
          </button>
        ))}
      </div>

      <div className="filter-fields">
        <label className="admin-field search-field">
          <span>Buscar por nome</span>
          <span className="field-control"><i className="bi bi-search" aria-hidden="true" /><input type="search" value={filters.search} onChange={(event) => update("search", event.target.value)} placeholder="Digite o nome do cliente" autoComplete="off" /></span>
        </label>
        <label className="admin-field modality-field">
          <span>Modalidade</span>
          <span className="field-control"><i className="bi bi-sliders" aria-hidden="true" /><select value={filters.modality} onChange={(event) => update("modality", event.target.value)}><option value="todos">Todas</option><option value="online">Online</option><option value="presencial">Presencial</option></select></span>
        </label>
      </div>
    </section>
  );
}
