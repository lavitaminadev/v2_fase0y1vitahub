import { useEffect, useState } from 'react';
import { API_ERROR_EVENT, type ApiErrorEventDetail } from '../core/api';

export function ApiErrorToast() {
  const [error, setError] = useState<ApiErrorEventDetail | null>(null);

  useEffect(() => {
    let timeoutId: number | undefined;
    const handleError = (event: Event) => {
      const detail = (event as CustomEvent<ApiErrorEventDetail>).detail;
      if (!detail?.message) return;
      setError(detail);
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => setError(null), detail.kind === 'connection' ? 10_000 : 7_000);
    };
    window.addEventListener(API_ERROR_EVENT, handleError);
    return () => {
      window.removeEventListener(API_ERROR_EVENT, handleError);
      window.clearTimeout(timeoutId);
    };
  }, []);

  if (!error) return null;
  return (
    <div className={`api-error-toast api-error-${error.kind}`} role="alert" aria-live="assertive">
      <span className="api-error-symbol" aria-hidden="true">!</span>
      <div><strong>{error.title}</strong><span>{error.message}</span>{error.kind === 'connection' && <button type="button" className="api-error-retry" onClick={() => window.location.reload()}>Comprobar de nuevo</button>}</div>
      <button type="button" className="api-error-close" onClick={() => setError(null)} aria-label="Cerrar alerta">×</button>
    </div>
  );
}
