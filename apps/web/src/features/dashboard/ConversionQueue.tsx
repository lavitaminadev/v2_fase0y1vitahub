import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';

/**
 * Estado de la cola de conversiones a Meta.
 *
 * Existe porque el circuito completo puede parecer correcto —reservas entrando, asistencias
 * marcadas— mientras los eventos se acumulan sin salir. Hasta ahora eso solo era visible
 * consultando el endpoint de cron con el secreto.
 */

interface OutboxProblem {
  id: string;
  eventId: string;
  pixelId: string;
  eventName: string | null;
  status: string;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  updatedAt: string;
}

interface OutboxState {
  stats: { pending: number; retry: number; processing: number; failed: number; expired: number; processed: number; total: number };
  problems: OutboxProblem[];
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En cola', retry: 'Reintentando', processing: 'Enviando', failed: 'Falló',
  expired: 'Vencido', processed: 'Enviado',
};

function dateTime(value: string): string {
  return new Date(value).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

export function ConversionQueue() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<OutboxState>({
    queryKey: ['meta-conversion-outbox'],
    queryFn: () => api.get('/integrations/meta/conversions/outbox'),
    refetchInterval: 60_000,
  });

  if (isLoading) return null;
  if (error) return <div className="alert alert-error">No pudimos leer la cola de conversiones: {error.message}</div>;
  if (!data) return null;

  const { stats, problems } = data;
  // Un token revocado deja los eventos en 'failed' y sin reintento: es el caso que exige
  // intervención manual, así que se destaca por separado del resto.
  const tokenIssues = problems.filter((problem) => (problem.lastError ?? '').includes('[TOKEN]'));
  const stuck = stats.processing > 0;
  // Un evento vencido es una conversión perdida de forma definitiva, así que cuenta como
  // problema: antes no aparecía en ningún número y la cola se veía sana mientras se perdían.
  const expired = stats.expired ?? 0;
  const healthy = stats.failed === 0 && stats.retry === 0 && expired === 0 && !stuck;

  return (
    <div className="section viz-root">
      <div className="section-title-row">
        <div>
          <h2>Cola de conversiones a Meta</h2>
          <p className="page-subtitle">Lo que se envió, lo que está en camino y lo que quedó trabado.</p>
        </div>
        <div className="viz-controls">
          <span className={`data-health ${healthy ? 'is-live' : ''}`}>{healthy ? 'Cola al día' : 'Requiere atención'}</span>
          <button type="button" className="btn btn-outline btn-sm" disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      <div className="viz-stat-row">
        <article><span>Enviados</span><strong>{stats.processed.toLocaleString('es-CL')}</strong><small>total histórico</small></article>
        <article><span>En cola</span><strong>{stats.pending.toLocaleString('es-CL')}</strong><small>se procesan cada 5 minutos</small></article>
        <article><span>Reintentando</span><strong>{stats.retry.toLocaleString('es-CL')}</strong><small>{stats.retry > 0 ? 'con espera progresiva' : 'sin reintentos'}</small></article>
        <article><span>Fallidos</span><strong>{stats.failed.toLocaleString('es-CL')}</strong><small>{stats.failed > 0 ? 'no se reintentan solos' : 'ninguno'}</small></article>
        <article><span>Vencidos</span><strong>{expired.toLocaleString('es-CL')}</strong><small>{expired > 0 ? 'fuera de la ventana de Meta' : 'ninguno'}</small></article>
      </div>

      {expired > 0 && (
        <div className="alert alert-error" role="alert">
          <strong>{expired} conversión(es) se perdieron por antigüedad.</strong> El evento llegó a la cola después de
          la ventana que Meta acepta —7 días desde la web, 62 desde el local— y ya no puede atribuirse.
          Suele indicar que la asistencia se está marcando demasiado tarde, o que el cron estuvo detenido.
        </div>
      )}

      {tokenIssues.length > 0 && (
        <div className="alert alert-error" role="alert">
          <strong>Token de Conversions API inválido o revocado.</strong> {tokenIssues.length} evento(s) no se enviaron por esto.
          Vuelve a generar el token del Pixel en Events Manager y reconfigúralo para el cliente; los eventos siguen dentro de la ventana de reenvío.
        </div>
      )}

      {stuck && (
        <div className="alert alert-info">
          Hay {stats.processing} evento(s) marcados como “enviando”. Si el número no baja en los próximos minutos,
          una ejecución se cortó a mitad: vuelven a la cola automáticamente a los 10 minutos.
        </div>
      )}

      {problems.length === 0 ? (
        <div className="empty-insight">
          <strong>Sin eventos con problemas</strong>
          <span>Todas las conversiones registradas se enviaron o están en camino.</span>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <caption className="viz-caption">Eventos que no lograron enviarse, del más reciente al más antiguo</caption>
            <thead>
              <tr><th>Evento</th><th>Pixel</th><th>Estado</th><th>Intentos</th><th>Motivo</th><th>Próximo intento</th></tr>
            </thead>
            <tbody>
              {problems.map((problem) => (
                <tr key={problem.id}>
                  <td data-label="Evento"><div className="crm-table-stack"><strong>{problem.eventName ?? 'Evento'}</strong><small>{problem.eventId}</small></div></td>
                  <td data-label="Pixel">{problem.pixelId}</td>
                  <td data-label="Estado"><span className={`meta-readiness is-${problem.status === 'failed' ? 'warn' : 'off'}`}>{STATUS_LABELS[problem.status] ?? problem.status}</span></td>
                  <td data-label="Intentos">{problem.attempts}</td>
                  <td data-label="Motivo">{problem.lastError ?? 'Sin detalle'}</td>
                  <td data-label="Próximo intento">{problem.nextAttemptAt ? dateTime(problem.nextAttemptAt) : 'Requiere intervención'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
