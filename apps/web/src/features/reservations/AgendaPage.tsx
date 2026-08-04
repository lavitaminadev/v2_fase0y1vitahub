/**
 * @fileoverview Agenda del servicio: tablero del día agrupado por zona/área.
 *
 * Cada cliente configura sus propias zonas en `resourcesConfig` del formulario de
 * reservas (Terraza, Salón, Barra...). Esta vista lee ese catálogo tal cual está
 * configurado y ubica las reservas del día en columnas por zona, ordenadas por hora.
 * Si el formulario no define zonas, todo cae en una única columna "General".
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { EmptyState } from '../../shared/EmptyState';
import { CYCLE_COLORS, RESERVATION_STATUS_OPTIONS, findStatusOption } from '../../shared/status-palette';
import type { Reservation, ReservationForm } from './types';
import './AgendaPage.css';

interface Client { id: string; name: string }
interface ReservationPage { items: Reservation[]; total: number; page: number; pageSize: number; pages: number }

const GENERAL_ZONE_ID = '__general__';
const NO_SHOW_STATUSES = new Set(['no_show']);

/** Fecha en formato `YYYY-MM-DD` a partir de un `Date` local. */
function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftDate(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  const next = new Date(year, month - 1, day + days);
  return dateKey(next);
}

function formatDateLabel(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const label = date.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function AgendaPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [dateFilter, setDateFilter] = useState(() => dateKey(new Date()));
  const [clientId, setClientId] = useState(searchParams.get('clientId') ?? '');
  const [formId, setFormId] = useState('');
  const [mobileZone, setMobileZone] = useState<string>('');

  const { data: clientsResp, isLoading: loadingClients, error: clientsError, refetch: refetchClients } = useQuery<{ data: Client[] }>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
  });
  const clients = Array.isArray(clientsResp?.data) ? clientsResp!.data : [];

  const { data: formsArray = [], isLoading: loadingForms } = useQuery<ReservationForm[]>({
    queryKey: ['reservation-forms', clientId],
    queryFn: () => api.get(`/reservations/forms${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`),
    enabled: Boolean(clientId),
  });
  const forms = Array.isArray(formsArray) ? formsArray : [];
  const activeForm = forms.find((form) => form.id === formId) ?? forms[0];
  const effectiveFormId = formId || activeForm?.id || '';

  const dayFrom = `${dateFilter}T00:00:00`;
  const dayTo = `${dateFilter}T23:59:59`;
  const {
    data: reservationPage,
    isLoading: loadingReservations,
    isFetching: fetchingReservations,
    error: reservationsError,
    refetch: refetchReservations,
  } = useQuery<ReservationPage>({
    queryKey: ['agenda-reservations', clientId, effectiveFormId, dateFilter],
    queryFn: () => api.get(`/reservations?${new URLSearchParams({ clientId, formId: effectiveFormId, from: dayFrom, to: dayTo, pageSize: '200' })}`),
    enabled: Boolean(clientId && effectiveFormId),
  });
  const reservations = Array.isArray(reservationPage?.items) ? reservationPage!.items : [];

  const zones = useMemo(() => {
    const configured = activeForm?.resourcesConfig ?? [];
    if (configured.length === 0) return [{ id: GENERAL_ZONE_ID, name: 'General' }];
    return configured.map((zone) => ({ id: zone.id, name: zone.name }));
  }, [activeForm]);

  const reservationsByZone = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    zones.forEach((zone) => map.set(zone.id, []));
    reservations.forEach((reservation) => {
      const zoneId = (reservation as Reservation & { resourceId?: string }).resourceId;
      const key = zoneId && map.has(zoneId) ? zoneId : GENERAL_ZONE_ID;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(reservation);
    });
    map.forEach((list) => list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
    return map;
  }, [reservations, zones]);

  const summary = useMemo(() => {
    const total = reservations.length;
    const noShows = reservations.filter((reservation) => NO_SHOW_STATUSES.has(reservation.status)).length;
    const occupied = reservations.filter((reservation) => !['cancelled_client', 'cancelled_business'].includes(reservation.status)).length;
    const capacity = activeForm?.dailyCapacity || 0;
    const occupancyPct = capacity > 0 ? Math.round((occupied / capacity) * 100) : null;
    return { total, noShows, occupancyPct };
  }, [reservations, activeForm]);

  const isLoading = loadingClients || (Boolean(clientId) && loadingForms);
  if (isLoading) return <LoadingSpinner text="Preparando la agenda del servicio..." />;
  if (clientsError) return <QueryErrorState title="No pudimos abrir la agenda" message={clientsError.message} onRetry={() => void refetchClients()} />;

  const goToReservation = (reservation: Reservation) => {
    navigate(`/reservations?tab=bookings&search=${encodeURIComponent(reservation.referenceCode)}`);
  };

  return <div className="page agenda-page">
    <div className="agenda-head">
      <div>
        <span className="page-eyebrow">OPERACIÓN DIARIA</span>
        <h1>Agenda del servicio</h1>
        <p className="page-subtitle">Vista del día agrupada por zona, tal como cada cliente configura su local.</p>
      </div>
    </div>

    <div className="agenda-controls">
      <select className="input" aria-label="Cliente" value={clientId} onChange={(event) => { setClientId(event.target.value); setFormId(''); }}>
        <option value="">Selecciona un cliente</option>
        {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
      </select>
      <select className="input" aria-label="Formulario" value={effectiveFormId} disabled={!clientId || forms.length === 0} onChange={(event) => setFormId(event.target.value)}>
        {forms.length === 0
          ? <option value="">Sin formularios</option>
          : forms.map((form) => <option key={form.id} value={form.id}>{form.name}</option>)}
      </select>
      <div className="agenda-date-nav">
        <button type="button" className="btn btn-outline btn-sm" aria-label="Día anterior" onClick={() => setDateFilter((current) => shiftDate(current, -1))}>‹</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setDateFilter(dateKey(new Date()))}>Hoy</button>
        <button type="button" className="btn btn-outline btn-sm" aria-label="Día siguiente" onClick={() => setDateFilter((current) => shiftDate(current, 1))}>›</button>
        <input className="input" type="date" aria-label="Elegir fecha" value={dateFilter} onChange={(event) => setDateFilter(event.target.value || dateKey(new Date()))} />
      </div>
      <strong className="agenda-date-label">{formatDateLabel(dateFilter)}</strong>
    </div>

    {!clientId
      ? <EmptyState icon="📅" title="Elige un cliente" description="Selecciona un cliente y un formulario para ver la agenda del día." />
      : forms.length === 0 && !loadingForms
        ? <EmptyState icon="📋" title="Sin formularios de reserva" description="Este cliente todavía no tiene un formulario de reservas configurado." />
        : <>
          <div className="agenda-summary" aria-label="Resumen del día">
            <div className="agenda-summary-badge"><strong>{fetchingReservations ? '—' : summary.total}</strong><span>Reservas hoy</span></div>
            <div className="agenda-summary-badge"><strong>{summary.occupancyPct === null ? '—' : `${summary.occupancyPct}%`}</strong><span>Ocupación</span></div>
            <div className="agenda-summary-badge is-warn"><strong>{fetchingReservations ? '—' : summary.noShows}</strong><span>No-shows</span></div>
          </div>

          {reservationsError
            ? <QueryErrorState title="No pudimos cargar las reservas del día" message={reservationsError.message} onRetry={() => void refetchReservations()} retrying={fetchingReservations} />
            : loadingReservations
              ? <LoadingSpinner text="Cargando reservas del día..." />
              : <>
                {zones.length > 1 && <div className="agenda-zone-tabs" role="tablist" aria-label="Zonas">
                  {zones.map((zone) => <button
                    key={zone.id}
                    type="button"
                    role="tab"
                    aria-selected={mobileZone ? mobileZone === zone.id : zone === zones[0]}
                    className={(mobileZone ? mobileZone === zone.id : zone === zones[0]) ? 'active' : ''}
                    onClick={() => setMobileZone(zone.id)}
                  >{zone.name}<span>{reservationsByZone.get(zone.id)?.length ?? 0}</span></button>)}
                </div>}

                <div className="agenda-board">
                  {zones.map((zone) => {
                    const items = reservationsByZone.get(zone.id) ?? [];
                    const isHiddenOnMobile = zones.length > 1 && (mobileZone ? mobileZone !== zone.id : zone !== zones[0]);
                    return <section key={zone.id} className={`agenda-column ${isHiddenOnMobile ? 'is-hidden-mobile' : ''}`} aria-label={zone.name}>
                      <header className="agenda-column-head"><h2>{zone.name}</h2><span>{items.length}</span></header>
                      {items.length === 0
                        ? <p className="agenda-column-empty">Sin reservas</p>
                        : <div className="agenda-column-body">
                          {items.map((reservation) => {
                            const option = findStatusOption(RESERVATION_STATUS_OPTIONS, reservation.status);
                            const color = option?.color ?? CYCLE_COLORS.pending;
                            return <button
                              key={reservation.id}
                              type="button"
                              className="agenda-card"
                              style={{ '--card-color': color } as React.CSSProperties}
                              onClick={() => goToReservation(reservation)}
                            >
                              <div className="agenda-card-time">{new Date(reservation.startsAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</div>
                              <div className="agenda-card-body">
                                <strong>{reservation.guestName}</strong>
                                <span>{reservation.partySize} persona{reservation.partySize === 1 ? '' : 's'}</span>
                              </div>
                              <span className="agenda-card-status" title={option?.label ?? reservation.status}>{option?.icon ?? '●'}</span>
                            </button>;
                          })}
                        </div>}
                    </section>;
                  })}
                </div>

                <ul className="agenda-legend" aria-label="Referencia de colores de estado">
                  {RESERVATION_STATUS_OPTIONS.map((option) => <li key={option.value}><span className="agenda-legend-dot" style={{ background: option.color }} />{option.label}</li>)}
                </ul>
              </>}
        </>}
  </div>;
}
