interface QueryErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function QueryErrorState({ title = 'No pudimos cargar esta vista', message = 'La información sigue segura. Revisa la conexión e intenta nuevamente.', onRetry, retrying = false }: QueryErrorStateProps) {
  return <div className="query-error-state" role="alert"><span aria-hidden="true">!</span><div><strong>{title}</strong><p>{message}</p>{onRetry && <button className="btn btn-primary btn-sm" onClick={onRetry} disabled={retrying}>{retrying ? 'Reintentando...' : 'Volver a intentar'}</button>}</div></div>;
}
