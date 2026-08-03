import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { StatusBadge } from '../../shared/StatusBadge';
import type { Reservation, ReservationForm } from './types';

interface Client { id: string; name: string }
interface ReservationPage { items: Reservation[]; total: number }

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthDays(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const cells: Array<{ key: string; date?: Date }> = [];
  for (let i = 0; i < leading; i += 1) cells.push({ key: `empty-${i}` });
  for (let day = 1; day <= daysInMonth; day += 1) cells.push({ key: `${month}-${day}`, date: new Date(year, monthNumber - 1, day) });
  return cells;
}

export function ReservationCalendarPage({ clientView = false }: { clientView?: boolean }) {
  const [searchParams] = useSearchParams();
  const [clientFilter, setClientFilter] = useState(clientView ? '' : searchParams.get('clientId') ?? '');
  const [formFilter, setFormFilter] = useState('');
  const [month, setMonth] = useState(monthKey(new Date()));
  const reservationQuery = new URLSearchParams({ page: '1', pageSize: '100', ...(clientFilter ? { clientId: clientFilter } : {}), ...(formFilter ? { formId: formFilter } : {}) });

  const formsQuery = useQuery<ReservationForm[]>({
    queryKey: ['calendar-forms', clientFilter],
    queryFn: () => api.get(`/reservations/forms${clientFilter ? `?clientId=${encodeURIComponent(clientFilter)}` : ''}`),
  });
  const clientsQuery = useQuery<{ data: Client[] }>({ queryKey: ['clients'], queryFn: () => api.get('/clients'), enabled: !clientView });
  const reservationsQuery = useQuery<ReservationPage>({
    queryKey: ['calendar-reservations', clientFilter, formFilter],
    queryFn: () => api.get(`/reservations?${reservationQuery}`),
  });

  const forms = Array.isArray(formsQuery.data) ? formsQuery.data : [];
  const clients = clientsQuery.data?.data ?? [];
  const reservations = reservationsQuery.data?.items ?? [];
  const selectedMonthReservations = reservations.filter((reservation) => reservation.startsAt.slice(0, 7) === month);
  const byDay = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const reservation of selectedMonthReservations) {
      const key = reservation.startsAt.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), reservation]);
    }
    return map;
  }, [selectedMonthReservations]);
  const confirmed = selectedMonthReservations.filter((item) => ['confirmed', 'rescheduled'].includes(item.status)).length;
  const attended = selectedMonthReservations.filter((item) => item.status === 'attended').length;
  const noShow = selectedMonthReservations.filter((item) => item.status === 'no_show').length;

  if (formsQuery.isLoading || reservationsQuery.isLoading) return <LoadingSpinner text="Preparando calendario..." />;
  if (formsQuery.error) return <QueryErrorState title="No pudimos cargar agendas" message={formsQuery.error.message} />;
  if (reservationsQuery.error) return <QueryErrorState title="No pudimos cargar reservas" message={reservationsQuery.error.message} />;

  return (
    <div className="page reservation-module">
      <section className="reservation-page-head">
        <div><span className="reservation-brand">CALENDARIO</span><h1>Calendario operativo</h1><p>Reservas por fecha, cliente y agenda.</p></div>
        <Link className="btn reservation-cta" to={clientView ? '/portal/reservations' : '/reservations'}>Ver reservas</Link>
      </section>
      <div className="reservation-status-summary calendar-summary" aria-label="Resumen del calendario">
        <button><strong>{selectedMonthReservations.length}</strong><span>Reservas del mes</span></button>
        <button><strong>{confirmed}</strong><span>Confirmadas</span></button>
        <button><strong>{attended}</strong><span>Asistencias</span></button>
        <button><strong>{noShow}</strong><span>No asistio</span></button>
      </div>
      <div className="reservation-form-filters">
        <input className="input" type="month" aria-label="Mes" value={month} onChange={(event) => setMonth(event.target.value)} />
        {!clientView && <select className="input" aria-label="Filtrar por cliente" value={clientFilter} onChange={(event) => { setClientFilter(event.target.value); setFormFilter(''); }}>
          <option value="">Todos los clientes</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>}
        <select className="input" aria-label="Filtrar por agenda" value={formFilter} onChange={(event) => setFormFilter(event.target.value)}>
          <option value="">Todas las agendas</option>
          {forms.map((form) => <option key={form.id} value={form.id}>{form.name}</option>)}
        </select>
      </div>
      <section className="calendar-board" aria-label="Calendario mensual">
        {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((day) => <strong className="calendar-weekday" key={day}>{day}</strong>)}
        {monthDays(month).map((cell) => {
          const items = cell.date ? byDay.get(dayKey(cell.date)) ?? [] : [];
          return (
            <article className={`calendar-cell ${!cell.date ? 'is-empty' : ''} ${items.length >= 6 ? 'is-full' : ''}`} key={cell.key}>
              {cell.date && <><header><strong>{cell.date.getDate()}</strong><span>{items.length} reserva{items.length === 1 ? '' : 's'}</span></header>
                <div>{items.slice(0, 4).map((item) => <button key={item.id} type="button"><b>{new Date(item.startsAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</b><span>{item.guestName}</span><StatusBadge status={item.status} /></button>)}</div>
                {items.length > 4 && <small>+{items.length - 4} mas</small>}</>}
            </article>
          );
        })}
      </section>
    </div>
  );
}
