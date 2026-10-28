const items = [
  ['atendimentos', 'Atendimentos', 'bi-grid-1x2'],
  ['dia', 'Agenda', 'bi-calendar3'],
  ['semanal', 'Disponibilidade', 'bi-clock-history'],
  ['extras', 'Horários extras', 'bi-plus-circle'],
  ['bloqueios', 'Bloqueios', 'bi-slash-circle'],
];

export default function AdminSidebar({ view, onViewChange, user, onLogout }) {
  return (
    <aside className="admin-sidebar" aria-label="Navegação administrativa">
      <div className="admin-sidebar-label">Organização</div>
      <nav className="admin-sidebar-nav">
        {items.map(([key, label, icon]) => (
          <button
            key={`${key}-${label}`}
            type="button"
            className={view === key ? 'is-active' : ''}
            aria-current={view === key ? 'page' : undefined}
            onClick={() => onViewChange(key)}
          >
            <i className={`bi ${icon}`} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="admin-sidebar-footer">
        <div className="admin-profile" aria-label={`Profissional: ${user?.nome || 'Psicóloga'}`}>
          <span className="admin-profile-mark" aria-hidden="true">{String(user?.nome || 'H').trim().slice(0, 1)}</span>
          <span><strong>{user?.nome || 'Psicóloga'}</strong><small>Área profissional</small></span>
        </div>
        <button type="button" className="admin-sidebar-logout" onClick={onLogout}><i className="bi bi-box-arrow-right" aria-hidden="true" /> Sair</button>
      </div>
    </aside>
  );
}
