export default function AgendaSummary({ summary }) {
  const items = [
    ["Hoje", summary.today, "Consultas no dia"],
    ["Próximas", summary.upcoming, "Atendimentos futuros"],
    ["Aguardando", summary.awaiting, "Pedem confirmação"],
  ];
  return (
    <section className="agenda-summary" aria-label="Resumo dos agendamentos">
      {items.map(([label, value, description], index) => <div key={label}><span className="summary-index">0{index + 1}</span><span className="admin-kicker">{label}</span><strong>{String(value).padStart(2, "0")}</strong><small>{description}</small></div>)}
    </section>
  );
}
