import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { EmptyState } from '../../shared/EmptyState';
import type { Reservation } from './types';

interface Client { id: string; name: string }
interface ReservationPage { items: Reservation[]; total: number; page: number; pageSize: number; pages: number }

/**
 * Expresa el tiempo transcurrido desde `createdAt` en una unidad legible (minutos u horas).
 *
 * Solo se usa para la columna "tiempo de espera": no persiste nada, se recalcula en cada
 * render a partir de la hora actual.
 */
function waitingTimeLabel(createdAt?: string): string {
  if (!createdAt) return 'Sin dato';
  const elapsedMs = Date.now() - new Date(createdAt).getTime();
  if (Number.isNaN(elapsedMs) || elapsedMs < 0) return 'Sin dato';
  const minutes = Math.floor(elapsedMs / 60000);
  if (minutes < 1) return 'Recién';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

/**
 * Vista de solo lectura con las reservas en estado `waitlist`.
 *
 * No gestiona el ciclo de vida de la reserva (eso sigue en ReservationsPage): aquí solo se
 * lista, se busca, se contacta al cliente por su medio ya guardado y se enlaza al detalle
 * real en la bandeja de reservas.
 */
export function WaitlistPage() {
  const [clientFilter, setClientFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const search = useDeferredValue(searchInput.trim());

  const { data: clientsResp } = useQuery<{ data: Client[] }>({ queryKey: ['clients'], queryFn: () => api.get('/clients') });
  const clients = Array.isArray((clientsResp as any)?.data) ? (clientsResp as any).data : [];

  const dateRange = dateFilter ? { from: dateFilter, to: `${dateFilter}T23:59:59` } : {};
  const query = new URLSearchParams({
    status: 'waitlist',
    page: '1',
    pageSize: '50',
    ...(clientFilter ? { clientId: clientFilter } : {}),
    ...(search ? { search } : {}),
    ...dateRange,
  });
  const { data: waitlistPage, isFetching, error, refetch } = useQuery<ReservationPage>({
    queryKey: ['reservations-waitlist', clientFilter, dateFilter, search],
    queryFn: () => api.get(`/reservations?${query}`),
    placeholderData: (previous) => previous,
  });
  const items = Array.isArray(waitlistPage?.items) ? waitlistPage!.items : [];

  const detailLink = (item: Reservation) => `/reservations?tab=bookings&search=${encodeURIComponent(item.referenceCode || item.guestName)}`;

  return <div className="page reservation-module">
    <div className="reservation-section-head">
      <div><span className="page-eyebrow">OPERACIÓN DIARIA</span><h1>Lista de espera</h1></div>
      <div className="reservation-actions">
        <p>{waitlistPage?.total ?? 0} en espera</p>
        <button className="btn btn-outline btn-sm" disabled title="Usa la bandeja de reservas">Añadir a la lista</button>
      </div>
    </div>

    <div className="reservation-filters">
      <input className="input" type="search" aria-label="Buscar en lista de espera" placeholder="Buscar nombre, teléfono, correo o código" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
      <select className="input" aria-label="Filtrar por cliente" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
        <option value="">Todos los clientes</option>
        {clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}
      </select>
      <label className="filter-date">Fecha<input className="input" type="date" aria-label="Filtrar por fecha" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></label>
      <button type="button" className="btn btn-outline btn-sm" disabled={!clientFilter && !dateFilter && !searchInput} onClick={() => { setClientFilter(''); setDateFilter(''); setSearchInput(''); }}>Limpiar</button>
    </div>

    {error ? <QueryErrorState title="No pudimos cargar la lista de espera" message={error.message} onRetry={() => void refetch()} retrying={isFetching} />
      : isFetching && !waitlistPage ? <LoadingSpinner text="Buscando reservas en espera..." />
      : items.length === 0 ? <EmptyState icon="⏳" title="Sin reservas en espera" description="Las solicitudes que queden en lista de espera aparecerán aquí." />
      : <div className="crm-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Cliente</th>
              <th>Personas</th>
              <th>Hora solicitada</th>
              <th>Tiempo de espera</th>
              <th>Notas</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => <tr key={item.id}>
              <td>{index + 1}</td>
              <td><strong>{item.guestName}</strong><br /><small>{item.guestPhone || item.guestEmail || 'Sin contacto'}</small></td>
              <td>{item.partySize}</td>
              <td>{new Date(item.startsAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}</td>
              <td>{waitingTimeLabel(item.createdAt)}</td>
              <td>{item.internalNotes || '—'}</td>
              <td>
                <div className="actions-cell">
                  {item.guestPhone && <a className="btn btn-outline btn-sm" href={`https://wa.me/${item.guestPhone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>}
                  {item.guestPhone && <a className="btn btn-outline btn-sm" href={`tel:${item.guestPhone}`}>Llamar</a>}
                  <Link className="btn btn-outline btn-sm" to={detailLink(item)}>Ver detalle</Link>
                </div>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>}
  </div>;
}
