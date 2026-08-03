import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../core/auth';
import { api } from '../../core/api';

interface ReservationForm {
  id: string;
  name: string;
  status: string;
  publicSlug: string;
  publicUrl?: string;
}

interface ReservationPage {
  items: Array<{ id: string; guestName: string; referenceCode: string; status: string; startsAt: string }>;
  total: number;
}

function publicUrl(form?: ReservationForm): string {
  if (!form) return '-';
  return form.publicUrl || `${window.location.origin}/book/${form.publicSlug}`;
}

export function ClientDashboard() {
  const { user } = useAuth();
  const formsQuery = useQuery<ReservationForm[]>({
    queryKey: ['client-dashboard-forms'],
    queryFn: () => api.get('/reservations/forms'),
  });
  const reservationsQuery = useQuery<ReservationPage>({
    queryKey: ['client-dashboard-reservations'],
    queryFn: () => api.get('/reservations?page=1&pageSize=5'),
  });

  const forms = formsQuery.data ?? [];
  const published = forms.filter((form) => form.status === 'published');
  const nextReservations = reservationsQuery.data?.items ?? [];
  const mainForm = published[0] ?? forms[0];

  return (
    <div className="page client-home-v2">
      <section className="compact-page-head">
        <div>
          <span className="page-eyebrow">Portal cliente</span>
          <h1>{user?.name}</h1>
          <p>Reservas, formularios y agenda de tu marca.</p>
        </div>
        <div className="compact-head-actions">
          <Link className="btn btn-primary btn-sm" to="/portal/reservations">Abrir reservas</Link>
          {mainForm && <a className="btn btn-outline btn-sm" href={publicUrl(mainForm)} target="_blank" rel="noreferrer">Enlace publico</a>}
        </div>
      </section>

      <section className="client-home-metrics">
        <article><span>Formularios visibles</span><strong>{forms.length}</strong><small>{published.length} publicados</small></article>
        <article><span>Reservas registradas</span><strong>{reservationsQuery.data?.total ?? 0}</strong><small>Solo de tu empresa</small></article>
        <article><span>Enlace principal</span><strong>{mainForm?.name ?? '-'}</strong><small>{publicUrl(mainForm)}</small></article>
      </section>

      <section className="client-home-grid">
        <article className="client-home-card">
          <span>Operacion diaria</span>
          <h2>Proximas reservas</h2>
          {nextReservations.length === 0 ? (
            <p>No hay reservas recientes para mostrar todavia.</p>
          ) : (
            <div className="client-reservation-list">
              {nextReservations.map((reservation) => (
                <div key={reservation.id}>
                  <strong>{reservation.guestName}</strong>
                  <span>#{reservation.referenceCode} - {reservation.status}</span>
                  <small>{new Date(reservation.startsAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</small>
                </div>
              ))}
            </div>
          )}
          <Link className="btn btn-outline btn-sm" to="/portal/reservations">Ver agenda completa</Link>
        </article>

        <article className="client-home-card is-guidance">
          <span>Vista acotada</span>
          <h2>Solo operacion de tu marca</h2>
          <p>Sin acceso a prospectos, pipeline, cotizaciones ni clientes comerciales de La Vitamina.</p>
        </article>
      </section>
    </div>
  );
}
