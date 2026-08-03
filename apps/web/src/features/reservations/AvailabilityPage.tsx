import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { StatusBadge } from '../../shared/StatusBadge';
import type { ReservationForm } from './types';

interface Client { id: string; name: string }

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

function formHealth(form: ReservationForm): { label: string; tone: 'ok' | 'warn' | 'off' } {
  if (form.status === 'paused') return { label: 'Pausada', tone: 'off' };
  if (!form.scheduleConfig?.windows?.length) return { label: 'Sin horarios', tone: 'warn' };
  if (!form.publicSlug) return { label: 'Sin enlace', tone: 'warn' };
  return { label: 'Publicable', tone: 'ok' };
}

export function AvailabilityPage({ clientView = false }: { clientView?: boolean }) {
  const [searchParams] = useSearchParams();
  const [clientFilter, setClientFilter] = useState(clientView ? '' : searchParams.get('clientId') ?? '');
  const formsQuery = useQuery<ReservationForm[]>({
    queryKey: ['availability-forms', clientFilter],
    queryFn: () => api.get(`/reservations/forms${clientFilter ? `?clientId=${encodeURIComponent(clientFilter)}` : ''}`),
  });
  const clientsQuery = useQuery<{ data: Client[] }>({ queryKey: ['clients'], queryFn: () => api.get('/clients'), enabled: !clientView });
  const forms = Array.isArray(formsQuery.data) ? formsQuery.data : [];
  const clients = clientsQuery.data?.data ?? [];

  const summary = useMemo(() => {
    const windows = forms.reduce((total, form) => total + (form.scheduleConfig?.windows?.length ?? 0), 0);
    const published = forms.filter((form) => form.status === 'published').length;
    const warnings = forms.filter((form) => formHealth(form).tone !== 'ok').length;
    return { windows, published, warnings };
  }, [forms]);

  if (formsQuery.isLoading) return <LoadingSpinner text="Revisando disponibilidad..." />;
  if (formsQuery.error) return <QueryErrorState title="No pudimos cargar disponibilidad" message={formsQuery.error.message} />;

  return (
    <div className="page reservation-module">
      <section className="reservation-page-head">
        <div><span className="reservation-brand">DISPONIBILIDAD</span><h1>Horarios y capacidad</h1><p>Control operativo de agendas publicadas, cupos y ventanas de atención.</p></div>
        <Link className="btn reservation-cta" to={clientView ? '/portal/reservations' : '/reservations'}>Administrar agendas</Link>
      </section>
      <div className="reservation-status-summary calendar-summary">
        <button><strong>{forms.length}</strong><span>Agendas</span></button>
        <button><strong>{summary.published}</strong><span>Publicadas</span></button>
        <button><strong>{summary.windows}</strong><span>Ventanas</span></button>
        <button className={summary.warnings ? 'needs-review' : ''}><strong>{summary.warnings}</strong><span>Alertas</span></button>
      </div>
      {!clientView && <div className="reservation-form-filters"><select className="input" aria-label="Filtrar por cliente" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}><option value="">Todos los clientes</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>}
      <section className="availability-grid">
        {forms.map((form) => {
          const health = formHealth(form);
          const windowsByDay = new Map<number, Array<{ start: string; end: string }>>();
          for (const window of form.scheduleConfig?.windows ?? []) windowsByDay.set(window.day, [...(windowsByDay.get(window.day) ?? []), window]);
          return (
            <article className="availability-card" key={form.id}>
              <header><div><h3>{form.name}</h3><small>{form.timezone}</small></div><StatusBadge status={form.status} /></header>
              <div className={`availability-health is-${health.tone}`}><strong>{health.label}</strong><span>{form.capacityPerSlot} cupo(s) cada {form.durationMinutes} min</span></div>
              <div className="availability-week">
                {DAYS.map((day, index) => {
                  const ranges = windowsByDay.get(index) ?? [];
                  return <div key={day}><strong>{day.slice(0, 3)}</strong><span>{ranges.length ? ranges.map((range) => `${range.start}-${range.end}`).join(', ') : 'Cerrado'}</span></div>;
                })}
              </div>
              <div className="form-card-actions"><Link className="btn btn-primary btn-sm" to={clientView ? `/portal/reservations/forms/${form.id}` : `/reservations/forms/${form.id}`}>Editar disponibilidad</Link></div>
            </article>
          );
        })}
        {forms.length === 0 && <div className="reservation-empty"><strong>Sin agendas</strong><p>Crea una agenda para configurar horarios y cupos.</p></div>}
      </section>
    </div>
  );
}
