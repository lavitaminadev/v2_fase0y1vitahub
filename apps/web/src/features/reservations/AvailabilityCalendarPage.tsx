import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { EmptyState } from '../../shared/EmptyState';
import './AvailabilityCalendarPage.css';

interface Client { id: string; name: string }
interface OccupancyDay { date: string; count: number; pct: number | null }
interface OccupancyResponse { month: string; capacity: number; days: OccupancyDay[] }

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Umbrales de ocupación: por debajo de 70% se lee como holgado, entre 70 y 90 como ajustado, sobre 90 como saturado. */
function occupancyTone(pct: number): 'low' | 'mid' | 'high' {
  if (pct >= 90) return 'high';
  if (pct >= 70) return 'mid';
  return 'low';
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

/**
 * Arma la grilla de semanas de un mes calendario (semanas que empiezan en lunes),
 * rellenando con `null` los días fuera de mes al inicio y al final de la primera
 * y última semana, de modo que el grid siempre tenga columnas de 7 días.
 */
function buildMonthGrid(date: Date): Array<Array<number | null>> {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay(): 0=domingo..6=sábado; convertimos a offset desde lunes.
  const leadingBlanks = (firstDay.getDay() + 6) % 7;

  const cells: Array<number | null> = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: Array<Array<number | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function AvailabilityCalendarPage() {
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [clientId, setClientId] = useState('');

  const { data: clientsResp } = useQuery<{ data: Client[] }>({ queryKey: ['clients'], queryFn: () => api.get('/clients') });
  const clients = Array.isArray((clientsResp as any)?.data) ? (clientsResp as any).data : [];

  const month = monthKey(cursor);
  const { data: occupancy, isLoading, error, refetch, isFetching } = useQuery<OccupancyResponse>({
    queryKey: ['reservation-occupancy', month, clientId],
    queryFn: () => api.get(`/reservations/analytics/occupancy?month=${month}&clientId=${encodeURIComponent(clientId)}`),
    enabled: Boolean(clientId),
  });

  const dayByDate = useMemo(() => {
    const map = new Map<string, OccupancyDay>();
    for (const day of occupancy?.days ?? []) map.set(day.date, day);
    return map;
  }, [occupancy]);

  const weeks = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const hasCapacity = (occupancy?.capacity ?? 0) > 0;
  const todayKey = monthKey(new Date()) === month ? new Date().getDate() : null;

  const dateKeyFor = (day: number) => `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return <div className="page availability-calendar-page">
    <div className="reservation-section-head">
      <div><span className="page-eyebrow">DISPONIBILIDAD</span><h1>Calendario de disponibilidad</h1></div>
    </div>

    <div className="availability-toolbar">
      <select className="input" aria-label="Selecciona un cliente" value={clientId} onChange={(event) => setClientId(event.target.value)}>
        <option value="">Selecciona un cliente</option>
        {clients.map((client: Client) => <option key={client.id} value={client.id}>{client.name}</option>)}
      </select>
      <div className="availability-month-nav">
        <button type="button" className="btn btn-outline btn-sm" aria-label="Mes anterior" onClick={() => setCursor((current) => addMonths(current, -1))}>◀</button>
        <strong>{cursor.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}</strong>
        <button type="button" className="btn btn-outline btn-sm" aria-label="Mes siguiente" onClick={() => setCursor((current) => addMonths(current, 1))}>▶</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hoy</button>
      </div>
    </div>

    {!clientId ? (
      <EmptyState icon="📅" title="Elige un cliente" description="Selecciona un cliente para ver la ocupación diaria de su calendario." />
    ) : isLoading ? (
      <LoadingSpinner text="Calculando ocupación..." />
    ) : error ? (
      <QueryErrorState title="No pudimos cargar la ocupación" message={error.message} onRetry={() => void refetch()} retrying={isFetching} />
    ) : <>
      <div className="availability-calendar" role="table" aria-label="Calendario mensual de ocupación">
        <div className="availability-weekday-row" role="row">
          {WEEKDAY_LABELS.map((label) => <span key={label} role="columnheader">{label}</span>)}
        </div>
        {weeks.map((week, weekIndex) => <div className="availability-week-row" role="row" key={weekIndex}>
          {week.map((day, dayIndex) => {
            if (day === null) return <div className="availability-cell is-empty" key={dayIndex} aria-hidden="true" />;
            const info = dayByDate.get(dateKeyFor(day));
            const pct = info?.pct ?? null;
            const isToday = todayKey === day;
            return <div className={`availability-cell ${isToday ? 'is-today' : ''}`} role="cell" key={dayIndex}>
              <span className="availability-day-number">{day}</span>
              {info ? (
                hasCapacity && pct !== null ? (
                  <span className={`availability-badge tone-${occupancyTone(pct)}`} title={`${info.count} reserva(s) · ${pct}% de ocupación`}>{pct}%</span>
                ) : (
                  <span className="availability-badge tone-neutral" title={`${info.count} reserva(s), sin tope diario configurado`}>{info.count}</span>
                )
              ) : null}
            </div>;
          })}
        </div>)}
      </div>

      <div className="availability-legend" aria-label="Leyenda de ocupación">
        <span className="legend-item"><i className="legend-dot tone-low" /> Baja (&lt;70%)</span>
        <span className="legend-item"><i className="legend-dot tone-mid" /> Media (70-90%)</span>
        <span className="legend-item"><i className="legend-dot tone-high" /> Alta (&gt;90%)</span>
        {!hasCapacity && <span className="legend-item"><i className="legend-dot tone-neutral" /> Sin tope diario configurado (se muestra el número de reservas)</span>}
      </div>
    </>}
  </div>;
}
