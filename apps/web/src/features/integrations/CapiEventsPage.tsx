import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';

type CapiStatus = 'pending' | 'retry' | 'processing' | 'failed' | 'processed';

interface CapiStats {
  pending: number;
  retry: number;
  processing: number;
  failed: number;
  processed: number;
  total: number;
}

interface CapiEvent {
  id: string;
  eventId: string;
  pixelId: string;
  eventName: string | null;
  status: CapiStatus;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  safeEventData: {
    eventName: string | null;
    eventTime: number | null;
    eventSourceUrl: string | null;
    actionSource: string | null;
    eventId: string | null;
    customData: Record<string, unknown>;
    matchKeys: string[];
  };
}

interface CapiListResponse {
  items: CapiEvent[];
  total: number;
  limit: number;
  offset: number;
}

const STATUS_LABELS: Record<CapiStatus, string> = {
  pending: 'Pendiente',
  retry: 'Reintento',
  processing: 'Procesando',
  failed: 'Fallido',
  processed: 'Procesado',
};

const BUSINESS_STATS: Array<{ key: keyof CapiStats; label: string; helper: string }> = [
  { key: 'processed', label: 'Conversiones enviadas', helper: 'Eventos que Meta ya recibio.' },
  { key: 'pending', label: 'Listas para enviar', helper: 'Reservas/asistencias esperando cron.' },
  { key: 'retry', label: 'En reintento', helper: 'Se intentaran nuevamente.' },
  { key: 'failed', label: 'Requieren accion', helper: 'Errores que necesitan revision.' },
];

function formatDate(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

export function CapiEventsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventId, setEventId] = useState('');
  const [selected, setSelected] = useState<CapiEvent | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: '50' });
    if (status) params.set('status', status);
    if (eventName.trim()) params.set('eventName', eventName.trim());
    if (eventId.trim()) params.set('eventId', eventId.trim());
    return params.toString();
  }, [eventId, eventName, status]);

  const statsQuery = useQuery<CapiStats>({
    queryKey: ['meta-capi-events-stats'],
    queryFn: () => api.get('/integrations/meta/events/stats'),
  });

  const eventsQuery = useQuery<CapiListResponse>({
    queryKey: ['meta-capi-events', queryString],
    queryFn: () => api.get(`/integrations/meta/events?${queryString}`),
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => api.post(`/integrations/meta/events/${id}/retry`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-capi-events'] });
      queryClient.invalidateQueries({ queryKey: ['meta-capi-events-stats'] });
    },
  });

  if (statsQuery.isLoading || eventsQuery.isLoading) return <LoadingSpinner text="Cargando eventos CAPI..." />;

  const stats = statsQuery.data;
  const events = eventsQuery.data?.items ?? [];

  return (
    <div className="page capi-events-page">
      <section className="compact-page-head">
        <div>
          <span className="page-eyebrow">Meta Conversions API</span>
          <h1>Eventos CAPI</h1>
          <p>Conversiones de reservas y asistencias, sin datos personales crudos.</p>
        </div>
        <div className="compact-head-status">
          <strong>{(stats?.failed ?? 0) > 0 ? 'Revisar fallos' : 'Sin bloqueos'}</strong>
          <span>{stats?.total ?? 0} eventos</span>
        </div>
      </section>

      <section className="capi-stats-grid">
        {stats && BUSINESS_STATS.map((item) => (
          <article className="capi-stat-card" key={item.key}>
            <span>{item.label}</span>
            <strong>{stats[item.key]}</strong>
            <small>{item.helper}</small>
          </article>
        ))}
      </section>

      <section className="integration-card capi-filter-card">
        <label>
          Estado
          <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>
          Evento
          <input className="input" value={eventName} onChange={(event) => setEventName(event.target.value)} placeholder="Schedule, Reserva_Asistida" />
        </label>
        <label>
          Event ID
          <input className="input" value={eventId} onChange={(event) => setEventId(event.target.value)} placeholder="schedule:..." />
        </label>
      </section>

      <section className="integration-card">
        <div className="integration-section-head">
          <div>
            <h2>Registro seguro de conversiones</h2>
            <p className="page-subtitle">{eventsQuery.data?.total ?? 0} eventos registrados. El detalle muestra trazabilidad, no datos sensibles.</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Evento</th>
                <th>Estado</th>
                <th>Intentos</th>
                <th>Reserva</th>
                <th>Actualizado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>
                    <strong>{event.eventName ?? '-'}</strong>
                    <small>{event.eventId}</small>
                  </td>
                  <td><span className={`status-pill status-${event.status}`}>{STATUS_LABELS[event.status]}</span></td>
                  <td>{event.attempts}</td>
                  <td>{String(event.safeEventData.customData.referenceCode ?? event.safeEventData.customData.reservationId ?? '-')}</td>
                  <td>{formatDate(event.updatedAt)}</td>
                  <td className="table-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelected(event)}>Ver</button>
                    {event.status !== 'processed' && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => retryMutation.mutate(event.id)} disabled={retryMutation.isPending}>
                        Reintentar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={6}>No hay eventos CAPI para los filtros actuales.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <section className="integration-card capi-detail-card">
          <div className="integration-section-head">
            <div>
              <h2>Detalle seguro</h2>
              <p className="page-subtitle">Se muestran claves de matching presentes, no sus valores.</p>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelected(null)}>Cerrar</button>
          </div>
          <dl className="capi-detail-grid">
            <div><dt>Event ID</dt><dd>{selected.eventId}</dd></div>
            <div><dt>Pixel</dt><dd>{selected.pixelId}</dd></div>
            <div><dt>Fuente</dt><dd>{selected.safeEventData.actionSource ?? '-'}</dd></div>
            <div><dt>Creado</dt><dd>{formatDate(selected.createdAt)}</dd></div>
            <div><dt>Proximo intento</dt><dd>{formatDate(selected.nextAttemptAt)}</dd></div>
            <div><dt>Datos de matching</dt><dd>{selected.safeEventData.matchKeys.join(', ') || '-'}</dd></div>
          </dl>
          {selected.lastError && <div className="alert alert-error">{selected.lastError}</div>}
          <pre className="capi-safe-payload">{JSON.stringify(selected.safeEventData.customData, null, 2)}</pre>
        </section>
      )}
    </div>
  );
}
