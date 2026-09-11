export function LoadingAgenda() {
  return <div className="agenda-loading" role="status" aria-live="polite"><span className="sr-only">Carregando agendamentos</span>{[0, 1, 2].map((item) => <span key={item} className="loading-row"><i /><i /><i /></span>)}</div>;
}

export function EmptyAgenda({ filtered, onClear }) {
  return <div className="agenda-empty"><span aria-hidden="true">∿</span><p className="admin-kicker">AGENDA EM PAUSA</p><h2>{filtered ? "Nenhum atendimento encontrado." : "Ainda não há atendimentos."}</h2><p>{filtered ? "Tente ajustar a busca ou os filtros para visualizar outros agendamentos." : "Quando um novo horário for solicitado pelo site, ele aparecerá organizado aqui."}</p>{filtered && <button type="button" className="admin-button secondary-button" onClick={onClear}>Limpar filtros</button>}</div>;
}

export function ErrorAgenda({ message, onRetry }) {
  return <div className="agenda-empty agenda-error" role="alert"><i className="bi bi-exclamation-circle" aria-hidden="true" /><p className="admin-kicker">NÃO FOI POSSÍVEL CARREGAR</p><h2>A agenda precisa de uma nova tentativa.</h2><p>{message}</p><button type="button" className="admin-button secondary-button" onClick={onRetry}>Tentar novamente</button></div>;
}

export function AdminToast({ message, tone = "success", onClose }) {
  if (!message) return null;
  return <div className={`admin-toast is-${tone}`} role={tone === "error" ? "alert" : "status"}><i className={`bi ${tone === "error" ? "bi-exclamation-circle" : "bi-check2-circle"}`} aria-hidden="true" /><span>{message}</span><button type="button" onClick={onClose} aria-label="Fechar mensagem"><i className="bi bi-x-lg" aria-hidden="true" /></button></div>;
}
