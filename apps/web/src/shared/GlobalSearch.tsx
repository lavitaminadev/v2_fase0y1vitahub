import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../core/api';
import type { Reservation, ReservationForm } from '../features/reservations/types';

interface Client { id: string; name: string; industry?: string }
interface ReservationPage { items: Reservation[] }

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim());
  const enabled = deferredQuery.length >= 2;
  const clientsQuery = useQuery<{ data: Client[] }>({ queryKey: ['global-search-clients'], queryFn: () => api.get('/clients'), enabled });
  const formsQuery = useQuery<ReservationForm[]>({ queryKey: ['global-search-forms'], queryFn: () => api.get('/reservations/forms'), enabled });
  const reservationsQuery = useQuery<ReservationPage>({
    queryKey: ['global-search-reservations', deferredQuery],
    queryFn: () => api.get(`/reservations?page=1&pageSize=8&search=${encodeURIComponent(deferredQuery)}`),
    enabled,
  });

  const results = useMemo(() => {
    if (!enabled) return [];
    const needle = deferredQuery.toLocaleLowerCase('es');
    const clients = (clientsQuery.data?.data ?? [])
      .filter((client) => client.name.toLocaleLowerCase('es').includes(needle) || (client.industry ?? '').toLocaleLowerCase('es').includes(needle))
      .slice(0, 4)
      .map((client) => ({ key: `client-${client.id}`, label: client.name, detail: client.industry || 'Cliente', to: `/clients/${client.id}`, type: 'Cliente' }));
    const forms = (formsQuery.data ?? [])
      .filter((form) => form.name.toLocaleLowerCase('es').includes(needle) || form.publicSlug.toLocaleLowerCase('es').includes(needle))
      .slice(0, 4)
      .map((form) => ({ key: `form-${form.id}`, label: form.name, detail: form.status, to: `/reservations/forms/${form.id}`, type: 'Agenda' }));
    const reservations = (reservationsQuery.data?.items ?? [])
      .map((reservation) => ({ key: `reservation-${reservation.id}`, label: reservation.guestName, detail: `#${reservation.referenceCode} · ${reservation.status}`, to: `/reservations?tab=bookings&search=${encodeURIComponent(reservation.guestEmail || reservation.guestPhone || reservation.guestName)}`, type: 'Reserva' }));
    return [...clients, ...forms, ...reservations].slice(0, 8);
  }, [clientsQuery.data, deferredQuery, enabled, formsQuery.data, reservationsQuery.data]);

  return (
    <div className="global-search-shell">
      <label>
        <span>Buscar</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cliente, reserva o agenda..." />
      </label>
      {enabled && <div className="global-search-results">
        {clientsQuery.isFetching || formsQuery.isFetching || reservationsQuery.isFetching ? <p>Buscando...</p> : results.length === 0 ? <p>Sin resultados</p> : results.map((result) => (
          <Link key={result.key} to={result.to} onClick={() => setQuery('')}>
            <span>{result.type}</span>
            <strong>{result.label}</strong>
            <small>{result.detail}</small>
          </Link>
        ))}
      </div>}
    </div>
  );
}
