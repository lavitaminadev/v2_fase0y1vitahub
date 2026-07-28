import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { reservationTotals, useReservationMetrics } from './use-reservation-metrics';

/**
 * Resultados del ciclo de reserva — el foco de la Fase 1.
 *
 * Responde tres preguntas en orden: cuanta gente completa el recorrido, como se
 * mueve dia a dia, y que campana trae a quienes de verdad asisten.
 *
 * Paleta: dos series categoricas (#2a78d6 / #1baf7a) validadas para daltonismo
 * sobre superficie blanca. El embudo usa una sola rampa verde de claro a oscuro
 * porque sus barras son magnitudes de un mismo flujo, no identidades distintas.
 */

const SERIES_RESERVAS = '#2a78d6';
const SERIES_ASISTENCIAS = '#1baf7a';
const FUNNEL_RAMP = ['#8fd0b8', '#55b995', '#2a9d78', '#17795c'];
const AXIS_INK = '#75857e';
const GRID_INK = '#e7ede8';

const RANGES = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
];

const numberFormat = (value: number) => value.toLocaleString('es-CL');
const dayFormat = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });

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
 * Panel de resultados del ciclo de reserva.
 *
 * @param clientId - Acota las métricas a un cliente. Sin él, el backend responde según el
 *   alcance de cuentas del usuario autenticado.
 * @param headingLevel - Nivel del encabezado del panel. Es 2 cuando el panel se incrusta bajo
 *   el título de otra vista, y 1 cuando el panel es el contenido principal de la ruta.
 */
export function ReservationResults({ clientId, headingLevel = 2 }: { clientId?: string; headingLevel?: 1 | 2 } = {}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const [days, setDays] = useState(30);
  const [showTable, setShowTable] = useState(false);
  const { data, isLoading, error, refetch, isFetching } = useReservationMetrics(days, clientId);

  const { attended, noShow, reservations, attendanceRate } = reservationTotals(data);

  const funnel = useMemo(() => {
    if (!data) return [];
    const stages = [
      { stage: 'Vieron la página', value: Number(data.funnel.views ?? 0) },
      { stage: 'Empezaron a reservar', value: Number(data.funnel.starts ?? 0) },
      { stage: 'Reservaron', value: Number(data.funnel.completed ?? 0) },
      { stage: 'Asistieron', value: attended },
    ];
    const top = stages[0].value;
    return stages.map((item, index) => ({ ...item, share: top > 0 ? Math.round((item.value / top) * 100) : null, fill: FUNNEL_RAMP[index] }));
  }, [attended, data]);

  const daily = useMemo(
    () => (data?.daily ?? []).map((row) => ({
      day: dayFormat(String(row.day).slice(0, 10)),
      Reservas: Number(row.total ?? 0),
      Asistencias: Number(row.attended ?? 0),
    })),
    [data],
  );

  const campaigns = useMemo(
    () => (data?.sources ?? [])
      .map((row) => {
        const total = Number(row.total ?? 0);
        const campaignAttended = Number(row.attended ?? 0);
        return {
          campaign: row.campaign || 'Sin campaña',
          source: row.source || 'directo',
          total,
          attended: campaignAttended,
          rate: total > 0 ? Math.round((campaignAttended / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 8),
    [data],
  );

  if (isLoading) return <LoadingSpinner text="Cargando resultados de reservas..." />;
  if (error) return <QueryErrorState title="No pudimos cargar los resultados de reservas" message={error.message} onRetry={() => void refetch()} retrying={isFetching} />;

  const emptyRange = reservations === 0 && Number(data?.funnel.views ?? 0) === 0;

  return (
    <div className="section viz-root">
      <div className="section-title-row">
        <div>
          <Heading>Resultados de reservas</Heading>
          <p className="page-subtitle">De la visita a la asistencia: lo que se le devuelve a Meta como conversión.</p>
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
          <button type="button" className="btn btn-outline btn-sm" aria-pressed={showTable} onClick={() => setShowTable((current) => !current)}>
            {showTable ? 'Ver gráficos' : 'Ver tabla'}
          </button>
        </div>
      </div>

      {emptyRange ? (
        <div className="empty-insight">
          <strong>Todavía no hay actividad en este rango</strong>
          <span>Cuando se publique un formulario y entren reservas, acá aparecen el embudo, la evolución diaria y el rendimiento por campaña.</span>
        </div>
      ) : (
        <>
          <div className="viz-stat-row">
            <article>
              <span>Reservas</span>
              <strong>{numberFormat(reservations)}</strong>
              <small>últimos {data?.days ?? days} días</small>
            </article>
            <article>
              <span>Asistencias</span>
              <strong>{numberFormat(attended)}</strong>
              <small>{noShow > 0 ? `${numberFormat(noShow)} no asistieron` : 'sin inasistencias'}</small>
            </article>
            <article>
              <span>Tasa de asistencia</span>
              <strong>{attendanceRate === null ? '—' : `${attendanceRate}%`}</strong>
              <small>de las reservas ya resueltas</small>
            </article>
            <article>
              <span>Conversión de la página</span>
              <strong>{data?.funnel.conversionRate == null ? '—' : `${data.funnel.conversionRate}%`}</strong>
              <small>visitas que terminan en reserva</small>
            </article>
          </div>

          {showTable ? (
            <div className="table-wrapper">
              <table className="data-table">
                <caption className="viz-caption">Reservas y asistencias por campaña, últimos {data?.days ?? days} días</caption>
                <thead>
                  <tr><th>Campaña</th><th>Origen</th><th>Reservas</th><th>Asistencias</th><th>Tasa</th></tr>
                </thead>
                <tbody>
                  {campaigns.map((row) => (
                    <tr key={`${row.source}-${row.campaign}`}>
                      <td data-label="Campaña">{row.campaign}</td>
                      <td data-label="Origen">{row.source}</td>
                      <td data-label="Reservas">{numberFormat(row.total)}</td>
                      <td data-label="Asistencias">{numberFormat(row.attended)}</td>
                      <td data-label="Tasa">{row.rate}%</td>
                    </tr>
                  ))}
                  {campaigns.length === 0 && <tr><td colSpan={5}>Sin campañas con reservas en este rango.</td></tr>}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              <div className="dashboard-charts-row">
                <div className="dashboard-chart-card">
                  <h3>Embudo de reserva</h3>
                  <p className="viz-note">Cuánta gente sobrevive cada paso del recorrido.</p>
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={funnel} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }}>
                      <CartesianGrid horizontal={false} stroke={GRID_INK} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: AXIS_INK }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="stage" type="category" width={132} tick={{ fontSize: 11, fill: AXIS_INK }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(23,63,53,.05)' }} />
                      <Bar dataKey="value" name="Personas" radius={[0, 4, 4, 0]} barSize={26} isAnimationActive={false}>
                        {funnel.map((item) => <Cell key={item.stage} fill={item.fill} />)}
                        <LabelList
                          dataKey="value"
                          position="right"
                          formatter={(value: number) => numberFormat(value)}
                          style={{ fill: '#173f35', fontSize: 11, fontWeight: 700 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="dashboard-chart-card">
                  <h3>Reservas y asistencias por día</h3>
                  <p className="viz-note">La distancia entre las dos líneas es lo que no llegó al local.</p>
                  <ResponsiveContainer width="100%" height={230}>
                    <LineChart data={daily} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
                      <CartesianGrid vertical={false} stroke={GRID_INK} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: AXIS_INK }} axisLine={false} tickLine={false} minTickGap={18} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: AXIS_INK }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconType="plainline" wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                      <Line type="monotone" dataKey="Reservas" stroke={SERIES_RESERVAS} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                      <Line type="monotone" dataKey="Asistencias" stroke={SERIES_ASISTENCIAS} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="dashboard-chart-card viz-full">
                <h3>Campañas que traen gente que asiste</h3>
                <p className="viz-note">Ordenadas por reservas. El porcentaje es cuántas de esas reservas terminaron asistiendo.</p>
                <ResponsiveContainer width="100%" height={Math.max(180, campaigns.length * 42)}>
                  <BarChart data={campaigns} layout="vertical" margin={{ top: 4, right: 88, bottom: 4, left: 4 }}>
                    <CartesianGrid horizontal={false} stroke={GRID_INK} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: AXIS_INK }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="campaign" type="category" width={168} tick={{ fontSize: 11, fill: AXIS_INK }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(23,63,53,.05)' }} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    <Bar dataKey="total" name="Reservas" fill={SERIES_RESERVAS} radius={[0, 4, 4, 0]} barSize={11} isAnimationActive={false} />
                    <Bar dataKey="attended" name="Asistencias" fill={SERIES_ASISTENCIAS} radius={[0, 4, 4, 0]} barSize={11} isAnimationActive={false}>
                      <LabelList
                        dataKey="rate"
                        position="right"
                        formatter={(value: number) => `${value}% asistió`}
                        style={{ fill: '#75857e', fontSize: 10, fontWeight: 700 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
