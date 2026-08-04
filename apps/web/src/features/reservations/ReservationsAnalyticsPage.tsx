import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { ForbiddenState } from '../../shared/ForbiddenState';
import { isForbiddenError } from '../../core/api';
import { EmptyState } from '../../shared/EmptyState';

/**
 * Dashboard de analíticas de reservas — panorama del período completo, no del
 * ciclo de conversión (eso ya lo cubre ReservationResults). Lee el mismo
 * endpoint `GET /reservations/analytics/metrics` pero además usa `areas`,
 * que el panel de resultados no necesita.
 *
 * Paleta: cian de marca para la serie principal, y una rampa derivada para
 * series secundarias (áreas, fuentes) que no compite visualmente con el cian.
 */

const SERIES_TOTAL = 'var(--cian)';
const SOURCE_RAMP = ['#0EC6B8', '#2a78d6', '#1baf7a', '#f2a93b', '#8a63d2', '#d64545', '#75857e'];
const AXIS_INK = '#75857e';
const GRID_INK = '#e7ede8';

interface AnalyticsMetrics {
  totals: {
    total?: number;
    pending?: number;
    confirmed?: number;
    attended?: number;
    no_show?: number;
    waitlist?: number;
    cancelled?: number;
  };
  daily: Array<{ day: string; total: number; attended: number; no_show: number }>;
  sources: Array<{ source: string; campaign: string; total: number; attended: number }>;
  areas: Array<{ area: string; total: number }>;
  funnel: { views: number; starts: number; completed: number; conversionRate: number | null };
  days: number;
}

const RANGES = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
];

const numberFormat = (value: number) => value.toLocaleString('es-CL');
const dayFormat = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });

function useAnalyticsMetrics(days: number, clientId?: string) {
  return useQuery<AnalyticsMetrics>({
    queryKey: ['reservation-analytics-metrics', days, clientId ?? null],
    queryFn: () => api.get(`/reservations/analytics/metrics?days=${days}${clientId ? `&clientId=${encodeURIComponent(clientId)}` : ''}`),
  });
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="viz-tooltip">
      {label && <strong>{label}</strong>}
      {payload.map((entry) => (
        <span key={entry.name}>
          <i style={{ background: entry.color }} aria-hidden="true" />
          {entry.name}: <b>{numberFormat(Number(entry.value ?? 0))}</b>
        </span>
      ))}
    </div>
  );
}

/**
 * Página de analíticas de reservas: KPIs del período y su desglose por día,
 * área/zona y fuente de origen.
 *
 * @param clientId - Acota las métricas a un cliente. Sin él, el backend responde según el
 *   alcance de cuentas del usuario autenticado.
 */
export function ReservationsAnalyticsPage({ clientId }: { clientId?: string } = {}) {
  const [days, setDays] = useState(30);
  const { data, isLoading, error, refetch, isFetching } = useAnalyticsMetrics(days, clientId);

  const totals = data?.totals ?? {};
  const total = Number(totals.total ?? 0);
  const attended = Number(totals.attended ?? 0);
  const noShow = Number(totals.no_show ?? 0);
  const resolved = attended + noShow;

  const daily = useMemo(
    () => (data?.daily ?? []).map((row) => ({
      day: dayFormat(String(row.day).slice(0, 10)),
      Reservas: Number(row.total ?? 0),
    })),
    [data],
  );

  const areas = useMemo(
    () => [...(data?.areas ?? [])]
      .map((row) => ({ area: row.area || 'Sin área', total: Number(row.total ?? 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
    [data],
  );

  const sources = useMemo(() => {
    const bySource = new Map<string, number>();
    for (const row of data?.sources ?? []) {
      const key = row.source || 'directo';
      bySource.set(key, (bySource.get(key) ?? 0) + Number(row.total ?? 0));
    }
    return [...bySource.entries()]
      .map(([source, value], index) => ({ source, value, fill: SOURCE_RAMP[index % SOURCE_RAMP.length] }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  if (isLoading) return <LoadingSpinner text="Cargando analíticas de reservas..." />;
  if (error) {
    return isForbiddenError(error) ? (
      <ForbiddenState />
    ) : (
      <QueryErrorState
        title="No pudimos cargar las analíticas de reservas"
        message={error.message}
        onRetry={() => void refetch()}
        retrying={isFetching}
      />
    );
  }

  const isEmpty = total === 0;

  return (
    <div className="section viz-root">
      <div className="section-title-row">
        <div>
          <h1>Analíticas de reservas</h1>
          <p className="page-subtitle">Panorama del período: volumen, ocupación por área y de dónde viene la gente.</p>
        </div>
        <div className="viz-controls">
          <div className="viz-range" role="group" aria-label="Rango de tiempo">
            {RANGES.map((range) => (
              <button
                key={range.days}
                type="button"
                className={days === range.days ? 'active' : ''}
                aria-pressed={days === range.days}
                onClick={() => setDays(range.days)}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          icon="[]"
          title="Todavía no hay reservas en este rango"
          description="Cuando entren reservas en este período, acá aparecen los KPIs y los gráficos de evolución, áreas y fuentes."
        />
      ) : (
        <>
          <div className="viz-stat-row">
            <article>
              <span>Reservas totales</span>
              <strong>{numberFormat(total)}</strong>
              <small>últimos {data?.days ?? days} días</small>
            </article>
            <article>
              <span>Cubiertos / personas</span>
              <strong>{numberFormat(attended)}</strong>
              <small>asistencias confirmadas</small>
            </article>
            <article>
              <span>No-shows</span>
              <strong>{numberFormat(noShow)}</strong>
              <small>{resolved > 0 ? `${Math.round((noShow / resolved) * 100)}% de las resueltas` : 'sin reservas resueltas'}</small>
            </article>
            <article>
              <span>Tasa de conversión</span>
              <strong>{data?.funnel.conversionRate == null ? '—' : `${data.funnel.conversionRate}%`}</strong>
              <small>visitas que terminan en reserva</small>
            </article>
          </div>

          <div className="dashboard-charts-row">
            <div className="dashboard-chart-card">
              <h3>Reservas por día</h3>
              <p className="viz-note">Evolución del volumen de reservas en el período.</p>
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={daily} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
                  <CartesianGrid vertical={false} stroke={GRID_INK} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: AXIS_INK }} axisLine={false} tickLine={false} minTickGap={18} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: AXIS_INK }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="Reservas" stroke={SERIES_TOTAL} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="dashboard-chart-card">
              <h3>Reservas por área</h3>
              <p className="viz-note">Qué zonas concentran más reservas en el período.</p>
              {areas.length === 0 ? (
                <p className="viz-note">Sin datos de área para este rango.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(180, areas.length * 32)}>
                  <BarChart data={areas} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
                    <CartesianGrid horizontal={false} stroke={GRID_INK} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: AXIS_INK }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="area" type="category" width={110} tick={{ fontSize: 11, fill: AXIS_INK }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(23,63,53,.05)' }} />
                    <Bar dataKey="total" name="Reservas" fill={SERIES_TOTAL} radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="dashboard-chart-card viz-full">
            <h3>Fuentes de origen</h3>
            <p className="viz-note">De dónde vienen las reservas, según utm_source.</p>
            {sources.length === 0 ? (
              <p className="viz-note">Sin datos de fuente para este rango.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                  <Pie
                    data={sources}
                    dataKey="value"
                    nameKey="source"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {sources.map((entry) => <Cell key={entry.source} fill={entry.fill} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}
