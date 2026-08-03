import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { ReservationResults } from './ReservationResults';
import { ConversionQueue } from './ConversionQueue';

interface DashboardData {
  activeClients: number;
}

interface PerformanceData {
  hasData: boolean;
  totals: { spend: number; leads: number; conversions: number };
  derived: { cpl: number | null; conversionRate: number | null };
}

const faseFlow = [
  { step: '01', title: 'Campana', body: 'Meta y enlaces publicos capturan demanda real.' },
  { step: '02', title: 'Reserva', body: 'El cliente agenda, deja datos y recibe confirmacion.' },
  { step: '03', title: 'Comensal', body: 'El contacto queda separado del CRM comercial.' },
  { step: '04', title: 'Asistencia', body: 'El equipo confirma asistencia o no-show.' },
  { step: '05', title: 'Meta', body: 'CAPI devuelve la conversion para medir campanas.' },
];

const focusCards = [
  {
    label: 'Operacion clientes',
    title: 'Reservas y formularios',
    body: 'Agenda, disponibilidad, enlaces publicos y reservas por cliente.',
    to: '/reservations',
    action: 'Abrir reservas',
  },
  {
    label: 'Restaurante -> comensal',
    title: 'Comensales y contactos',
    body: 'Personas que reservaron, asistieron o quedaron pendientes.',
    to: '/crm/contacts',
    action: 'Ver contactos',
  },
  {
    label: 'La Vitamina -> cliente',
    title: 'Pipeline comercial',
    body: 'Prospectos y oportunidades de la agencia, sin mezclar comensales.',
    to: '/crm/opportunities',
    action: 'Ver pipeline',
  },
  {
    label: 'Medicion',
    title: 'Eventos CAPI',
    body: 'Trazabilidad de conversiones enviadas o pendientes hacia Meta.',
    to: '/integrations/meta/events',
    action: 'Ver eventos',
  },
];

function formatMoney(value?: number | null): string {
  if (value == null) return '-';
  return `$${Math.round(value).toLocaleString('es-CL')}`;
}

export function DashboardPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/reporting/dashboard'),
  });
  const { data: performance } = useQuery<PerformanceData>({
    queryKey: ['performance'],
    queryFn: () => api.get('/reporting/performance'),
  });

  if (isLoading) return <LoadingSpinner text="Cargando centro de control..." />;
  if (error) return <QueryErrorState title="No pudimos cargar tu dashboard" message={error.message} onRetry={() => void refetch()} retrying={isFetching} />;

  return (
    <div className="page fase-dashboard">
      <section className="compact-page-head">
        <div>
          <span className="page-eyebrow">Fase 0 + Fase 1</span>
          <h1>Reservas, comensales y Meta</h1>
          <p>Operacion por cliente separada del CRM comercial de La Vitamina.</p>
        </div>
        <div className="compact-head-actions">
          <Link className="btn btn-primary btn-sm" to="/reservations">Reservas</Link>
          <Link className="btn btn-outline btn-sm" to="/integrations/meta/events">CAPI</Link>
        </div>
      </section>

      <section className="fase-flow" aria-label="Circuito de reservas y medicion">
        {faseFlow.map((item) => (
          <article key={item.step}>
            <b>{item.step}</b>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </article>
        ))}
      </section>

      <section className="fase-metrics-grid">
        <article>
          <span>Clientes activos</span>
          <strong>{data?.activeClients ?? 0}</strong>
          <small>Empresas administradas por La Vitamina.</small>
        </article>
        <article>
          <span>Leads Meta</span>
          <strong>{performance?.totals.leads ?? 0}</strong>
          <small>Demanda capturada por campanas conectadas.</small>
        </article>
        <article>
          <span>Conversiones</span>
          <strong>{performance?.totals.conversions ?? 0}</strong>
          <small>Reservas/asistencias listas para medicion.</small>
        </article>
        <article>
          <span>CPL estimado</span>
          <strong>{formatMoney(performance?.derived.cpl)}</strong>
          <small>{performance?.hasData ? 'Datos sincronizados.' : 'Pendiente conexion real Meta.'}</small>
        </article>
      </section>

      <section className="fase-focus-grid">
        {focusCards.map((card) => (
          <Link className="fase-focus-card" to={card.to} key={card.to}>
            <span>{card.label}</span>
            <strong>{card.title}</strong>
            <p>{card.body}</p>
            <b>{card.action}</b>
          </Link>
        ))}
      </section>

      <ReservationResults />

      <section className="fase-two-column">
        <div className="fase-story-card">
          <span className="page-eyebrow">Criterio de separacion</span>
          <h2>Dos CRM, dos objetivos</h2>
          <p><strong>CRM La Vitamina:</strong> prospectos, clientes agencia, oportunidades, propuesta y cierre.</p>
          <p><strong>CRM de clientes:</strong> comensales, reservas, asistencia y trazabilidad de campana.</p>
        </div>
        <ConversionQueue />
      </section>
    </div>
  );
}
