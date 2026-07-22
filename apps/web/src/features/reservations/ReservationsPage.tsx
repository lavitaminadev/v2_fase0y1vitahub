import { useDeferredValue, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../core/api';
import { Modal } from '../../shared/Modal';
import { StatusBadge } from '../../shared/StatusBadge';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import type { Reservation, ReservationForm } from './types';
import { localInputToUtc } from './local-time';
import { publicReservationUrl } from '../../core/public-url';

interface Client { id: string; name: string }
interface ReservationPage { items: Reservation[]; total: number; page: number; pageSize: number; pages: number }
interface ReservationEvent { id: string; type: string; fromStatus?: string; toStatus?: string; actorType: string; metadata?: Record<string, string>; createdAt: string }
interface Metrics {
  totals: { total: string; pending: string; confirmed: string; attended: string; no_show: string; waitlist: string; cancelled: string };
  funnel: { views: number; starts: number; completed: number; conversionRate: number | null };
  daily: Array<{ day: string; hour: number; total: string }>;
  sources: Array<{ source: string; campaign: string; total: string; attended: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmada', attended: 'Asistió', no_show: 'No asistió',
  rescheduled: 'Reagendada', cancelled_client: 'Cancelada por cliente',
  cancelled_business: 'Cancelada por empresa', waitlist: 'Lista de espera',
};
const NEXT_STATUSES: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled_client', 'cancelled_business', 'waitlist'],
  confirmed: ['rescheduled', 'cancelled_client', 'cancelled_business', 'attended', 'no_show'],
  rescheduled: ['confirmed', 'cancelled_client', 'cancelled_business', 'attended', 'no_show'],
  waitlist: ['confirmed', 'cancelled_client', 'cancelled_business'],
  attended: [], no_show: [], cancelled_client: [], cancelled_business: [],
};
const MODE_LABELS: Record<string, string> = { appointment: 'Reserva', group: 'Reserva grupal', request: 'Solicitud manual' };

export function ReservationsPage({ clientView = false }: { clientView?: boolean }) {
  const [searchParams] = useSearchParams();
  const initialClientId = clientView ? '' : searchParams.get('clientId') ?? '';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useState<'forms' | 'bookings' | 'metrics' | 'coupons'>(requestedTab === 'bookings' || requestedTab === 'metrics' || requestedTab === 'coupons' ? requestedTab : 'forms');
  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === '1');
  const [selectedBooking, setSelectedBooking] = useState<Reservation | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ formId: '', startsAt: '', guestName: '', guestEmail: '', guestPhone: '', partySize: 1, serviceId: '', resourceId: '', internalNotes: '', skipAvailability: false });
  const [couponTab, setCouponTab] = useState<'list' | 'create'>('list');
  const [couponForm, setCouponForm] = useState({ code: '', discountType: 'percentage', value: 0, maxUses: 0, validFrom: '', validUntil: '', formIds: '' });
  const [viewingCouponCode, setViewingCouponCode] = useState('');
  const [page, setPage] = useState(1);
  const [clientFilter, setClientFilter] = useState(initialClientId);
  const [formData, setFormData] = useState({ clientId: initialClientId, name: '', mode: 'appointment' });
  const [formFilters, setFormFilters] = useState({ search: '', status: '' });
  const [filters, setFilters] = useState({ search: searchParams.get('search') ?? '', status: '', formId: '' });
  const search = useDeferredValue(filters.search.trim());

  const clientQuery = clientFilter ? `?clientId=${encodeURIComponent(clientFilter)}` : '';
  const { data: forms = [], isLoading, error: formsError, refetch: refetchForms, isFetching: fetchingForms } = useQuery<ReservationForm[]>({ queryKey: ['reservation-forms', clientFilter], queryFn: () => api.get(`/reservations/forms${clientQuery}`) });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ['clients'], queryFn: () => api.get('/clients'), enabled: !clientView });
  const query = new URLSearchParams({ page: String(page), pageSize: '20', ...(clientFilter ? { clientId: clientFilter } : {}), ...(search ? { search } : {}), ...(filters.status ? { status: filters.status } : {}), ...(filters.formId ? { formId: filters.formId } : {}) });
  const { data: bookingPage, isFetching: loadingBookings } = useQuery<ReservationPage>({ queryKey: ['reservations', page, clientFilter, search, filters.status, filters.formId], queryFn: () => api.get(`/reservations?${query}`), enabled: tab === 'bookings', placeholderData: (previous) => previous });
  const bookings = bookingPage?.items || [];
  const { data: metrics } = useQuery<Metrics>({ queryKey: ['reservation-metrics', clientFilter], queryFn: () => api.get(`/reservations/analytics/metrics${clientQuery}`), enabled: tab === 'metrics' });
  const { data: history = [], isLoading: historyLoading } = useQuery<ReservationEvent[]>({ queryKey: ['reservation-history', selectedBooking?.id], queryFn: () => api.get(`/reservations/${selectedBooking!.id}/history`), enabled: Boolean(selectedBooking) });

  const createMutation = useMutation({
    mutationFn: () => api.post<ReservationForm>('/reservations/forms', formData),
    onSuccess: (created) => { qc.invalidateQueries({ queryKey: ['reservation-forms'] }); setCreateOpen(false); navigate(`/reservations/forms/${created.id}`); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { status?: string; startsAt?: string; internalNotes?: string } }) => api.patch<Reservation>(`/reservations/${id}`, body),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['reservation-metrics'] });
      qc.invalidateQueries({ queryKey: ['reservation-history', updated.id] });
      setSelectedBooking((current) => current?.id === updated.id ? updated : current);
      setRescheduleAt('');
    },
  });
  const duplicateMutation = useMutation({ mutationFn: (id: string) => api.post(`/reservations/forms/${id}/duplicate`), onSuccess: () => qc.invalidateQueries({ queryKey: ['reservation-forms'] }) });
  const updateFormMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch<ReservationForm>(`/reservations/forms/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservation-forms'] }),
  });
  const exportMutation = useMutation({
    mutationFn: () => api.get<Blob>(`/reservations/export/csv${clientQuery}`, { responseType: 'blob' }),
    onSuccess: (blob) => { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `reservas-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url); },
  });
  const manualMutation = useMutation({
    mutationFn: () => {
      const body = {
        ...manualForm,
        guestEmail: manualForm.guestEmail || undefined,
        guestPhone: manualForm.guestPhone || undefined,
        serviceId: manualForm.serviceId || undefined,
        resourceId: manualForm.resourceId || undefined,
        internalNotes: manualForm.internalNotes || undefined,
      };
      return api.post<Reservation>('/reservations/manual', body);
    },
    onSuccess: () => {
      setManualOpen(false);
      setManualForm({ formId: '', startsAt: '', guestName: '', guestEmail: '', guestPhone: '', partySize: 1, serviceId: '', resourceId: '', internalNotes: '', skipAvailability: false });
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['reservation-metrics'] });
    },
  });
  const { data: coupons = [] } = useQuery<Array<{ id: string; code: string; discountType: string; value: number; maxUses: number; usageCount: number; validFrom?: string; validUntil?: string; formIds?: string[]; active: boolean; createdAt: string }>>({ queryKey: ['coupons', clientFilter], queryFn: () => api.get(`/reservations/coupons${clientQuery}`), enabled: tab === 'coupons' });
  const couponCreate = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { code: couponForm.code.trim(), discountType: couponForm.discountType, value: couponForm.value, maxUses: couponForm.maxUses };
      if (couponForm.validFrom) body.validFrom = new Date(couponForm.validFrom).toISOString();
      if (couponForm.validUntil) body.validUntil = new Date(couponForm.validUntil).toISOString();
      if (couponForm.formIds.trim()) body.formIds = couponForm.formIds.split(',').map((s) => s.trim()).filter(Boolean);
      return api.post('/reservations/coupons', body);
    },
    onSuccess: () => { setCouponForm({ code: '', discountType: 'percentage', value: 0, maxUses: 0, validFrom: '', validUntil: '', formIds: '' }); setCouponTab('list'); qc.invalidateQueries({ queryKey: ['coupons'] }); },
  });
  const couponToggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/reservations/coupons/${id}`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coupons'] }),
  });
  const { data: couponUsages = [] } = useQuery<Reservation[]>({ queryKey: ['coupon-usages', viewingCouponCode], queryFn: () => api.get(`/reservations?couponCode=${encodeURIComponent(viewingCouponCode)}&pageSize=100`), enabled: Boolean(viewingCouponCode) });

  if (isLoading) return <LoadingSpinner text="Preparando Reservas..." />;
  if (formsError) return <QueryErrorState title="No pudimos abrir Reservas y formularios" message={formsError.message} onRetry={() => void refetchForms()} retrying={fetchingForms} />;
  const total = Number(metrics?.totals.total || 0);
  const attended = Number(metrics?.totals.attended || 0);
  const cancelled = Number(metrics?.totals.cancelled || 0);
  const noShow = Number(metrics?.totals.no_show || 0);
  const waitlist = Number(metrics?.totals.waitlist || 0);
  const dailyTotals = (metrics?.daily || []).reduce<Record<string, number>>((days, entry) => ({ ...days, [entry.day.slice(0, 10)]: (days[entry.day.slice(0, 10)] || 0) + Number(entry.total) }), {});
  const maxDailyTotal = Math.max(...Object.values(dailyTotals), 1);
  const formPath = (id: string) => clientView ? `/portal/reservations/forms/${id}` : `/reservations/forms/${id}`;
  const formPublicUrl = (form: ReservationForm) => publicReservationUrl(form.publicSlug, form.publicUrl);
  const clientForms = forms.filter((form) => !clientFilter || form.clientId === clientFilter);
  const visibleForms = clientForms.filter((form) => {
    const matchesStatus = !formFilters.status || form.status === formFilters.status;
    const needle = formFilters.search.trim().toLocaleLowerCase('es');
    return matchesStatus && (!needle || form.name.toLocaleLowerCase('es').includes(needle) || form.publicSlug.toLocaleLowerCase('es').includes(needle));
  });
  const formCounts = clientForms.reduce<Record<string, number>>((counts, form) => ({ ...counts, [form.status]: (counts[form.status] || 0) + 1 }), {});
  const backupForm = (form: ReservationForm) => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), form }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `formulario-${form.publicSlug}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const resetFilters = (patch: Partial<typeof filters>) => { setFilters((current) => ({ ...current, ...patch })); setPage(1); };

  return <div className="page reservation-module">
    <section className="reservation-hero">
      <div><span className="reservation-brand">VITAHUB RESERVAS Y FORMULARIOS</span><h1>Captura, agenda y mide en un solo flujo.</h1><p>Crea formularios y encuestas con campos arrastrables, publícalos por empresa y convierte cada respuesta en información operativa.</p></div>
      {!clientView && <button className="btn reservation-cta" onClick={() => { setFormData((current) => ({ ...current, clientId: clientFilter })); setCreateOpen(true); }}>Crear formulario</button>}
    </section>
    <nav className="reservation-tabs" aria-label="Secciones de reservas">
      {([['forms', 'Formularios y encuestas'], ['bookings', 'Datos recopilados'], ['metrics', 'Analítica de reservas'], ['coupons', 'Cupones']] as const).map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}{key === 'bookings' && bookingPage?.total ? <span>{bookingPage.total}</span> : null}</button>)}
    </nav>

    {tab === 'forms' && <section>
      <div className="reservation-section-head"><div><span className="page-eyebrow">CENTRO DE CAPTURA</span><h2>Formularios, encuestas y agendas</h2></div><p>{visibleForms.length} de {clientForms.length} activos visibles</p></div>
      <div className="reservation-status-summary" aria-label="Resumen de formularios"><button className={!formFilters.status ? 'active' : ''} onClick={() => setFormFilters((current) => ({ ...current, status: '' }))}><strong>{clientForms.length}</strong><span>Todos</span></button><button className={formFilters.status === 'published' ? 'active' : ''} onClick={() => setFormFilters((current) => ({ ...current, status: 'published' }))}><strong>{formCounts.published || 0}</strong><span>Publicados</span></button><button className={formFilters.status === 'paused' ? 'active' : ''} onClick={() => setFormFilters((current) => ({ ...current, status: 'paused' }))}><strong>{formCounts.paused || 0}</strong><span>Pausados</span></button><button className={formFilters.status === 'draft' ? 'active' : ''} onClick={() => setFormFilters((current) => ({ ...current, status: 'draft' }))}><strong>{formCounts.draft || 0}</strong><span>Borradores</span></button></div>
      <div className="reservation-form-filters"><input className="input" type="search" aria-label="Buscar formulario" placeholder="Buscar por nombre o enlace" value={formFilters.search} onChange={(event) => setFormFilters((current) => ({ ...current, search: event.target.value }))} />{!clientView && <select className="input" aria-label="Filtrar formularios por cliente" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}><option value="">Todos los clientes</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select>}<select className="input" aria-label="Filtrar formularios por estado" value={formFilters.status} onChange={(event) => setFormFilters((current) => ({ ...current, status: event.target.value }))}><option value="">Todos los estados</option><option value="published">Publicados</option><option value="paused">Pausados</option><option value="draft">Borradores</option></select></div>
      {visibleForms.length === 0 ? <div className="reservation-empty"><strong>Crea tu primera experiencia de reserva</strong><p>El asistente te guiará por datos, campos, disponibilidad, diseño y publicación.</p>{!clientView && <button className="btn btn-primary" onClick={() => { setFormData((current) => ({ ...current, clientId: clientFilter })); setCreateOpen(true); }}>Comenzar creación guiada</button>}</div> : <div className="reservation-form-grid">
        {visibleForms.map((form) => <article className="reservation-form-card" key={form.id}>
          <div className="form-card-accent" style={{ background: form.designConfig.primaryColor || '#173f35' }} />
          <div className="form-card-head"><span className="form-mode">{MODE_LABELS[form.mode] ?? form.mode}</span><StatusBadge status={form.status} /></div>
          <h3>{form.name}</h3><p>{formPublicUrl(form)}</p>{!clientView && <small className="form-client-name">{clients.find((client) => client.id === form.clientId)?.name || 'Cliente no disponible'}</small>}
          <div className="form-card-facts"><span>{form.durationMinutes} min</span><span>{form.capacityPerSlot} cupo(s)</span><span>{form.fieldSchema.length} campos</span></div>
          <div className="form-card-actions"><Link className="btn btn-primary btn-sm" to={formPath(form.id)}>{clientView ? 'Configurar agenda' : 'Editar diseño y flujo'}</Link><a className="btn btn-outline btn-sm" href={formPublicUrl(form)} target="_blank" rel="noreferrer">Abrir enlace</a>{!clientView && <button className="btn btn-outline btn-sm" onClick={() => duplicateMutation.mutate(form.id)}>Duplicar</button>}<button className="btn btn-outline btn-sm" onClick={() => backupForm(form)}>Respaldar JSON</button>{!clientView && form.status !== 'draft' && <button className="btn btn-outline btn-sm" disabled={updateFormMutation.isPending} onClick={() => updateFormMutation.mutate({ id: form.id, status: form.status === 'paused' ? 'published' : 'paused' })}>{form.status === 'paused' ? 'Reanudar' : 'Pausar'}</button>}</div>
        </article>)}
      </div>}
    </section>}

    {tab === 'bookings' && <section>
      <div className="reservation-section-head"><div><span className="page-eyebrow">OPERACIÓN DIARIA</span><h2>Lista de reservas</h2></div><div className="reservation-actions"><button className="btn btn-outline btn-sm" onClick={() => setManualOpen(true)}>Agregar reserva manual</button><button className="btn btn-outline btn-sm" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>{exportMutation.isPending ? 'Preparando...' : 'Exportar CSV'}</button></div></div>
      <div className="reservation-filters"><input className="input" aria-label="Buscar reservas" placeholder="Buscar nombre, teléfono, correo o código" value={filters.search} onChange={(event) => resetFilters({ search: event.target.value })} /><select className="input" aria-label="Filtrar por formulario" value={filters.formId} onChange={(event) => resetFilters({ formId: event.target.value })}><option value="">Todos los formularios</option>{forms.map((form) => <option value={form.id} key={form.id}>{form.name}</option>)}</select><select className="input" aria-label="Filtrar por estado" value={filters.status} onChange={(event) => resetFilters({ status: event.target.value })}><option value="">Todos los estados</option>{Object.entries(STATUS_LABELS).map(([status, label]) => <option value={status} key={status}>{label}</option>)}</select></div>
      {loadingBookings && !bookingPage ? <LoadingSpinner text="Buscando reservas..." /> : bookings.length === 0 ? <div className="reservation-empty"><strong>Sin reservas para estos filtros</strong><p>Las nuevas solicitudes aparecerán aquí en tiempo real.</p></div> : <div className="booking-list">
        {bookings.map((item) => { const next = NEXT_STATUSES[item.status] || []; return <article className="booking-row" key={item.id}>
          <div className="booking-date"><strong>{new Date(item.startsAt).getDate()}</strong><span>{new Date(item.startsAt).toLocaleDateString('es-CL', { month: 'short' })}</span><small>{new Date(item.startsAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</small></div>
          <button className="booking-guest booking-guest-button" onClick={() => { setSelectedBooking(item); setBookingNotes(item.internalNotes || ''); }}><strong>{item.guestName}</strong><span>{item.guestPhone || item.guestEmail || 'Sin contacto'}</span><small>#{item.referenceCode} · {item.utmCampaign || item.utmSource || 'Origen directo'}</small></button>
          <StatusBadge status={item.status} />
          <select className="input booking-status" aria-label={`Cambiar estado de ${item.guestName}`} value={item.status} disabled={next.length === 0 || updateMutation.isPending} onChange={(event) => updateMutation.mutate({ id: item.id, body: { status: event.target.value } })}><option value={item.status}>{STATUS_LABELS[item.status] || item.status}</option>{next.map((status) => <option value={status} key={status}>{STATUS_LABELS[status]}</option>)}</select>
        </article>; })}
      </div>}
      {(bookingPage?.pages || 0) > 1 && <nav className="reservation-pagination" aria-label="Páginas de reservas"><button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button><span>Página {bookingPage?.page} de {bookingPage?.pages} · {bookingPage?.total} reservas</span><button className="btn btn-outline btn-sm" disabled={page >= (bookingPage?.pages || 1)} onClick={() => setPage((value) => value + 1)}>Siguiente</button></nav>}
    </section>}

    {tab === 'metrics' && <section>
      <div className="reservation-section-head"><div><span className="page-eyebrow">ÚLTIMOS 30 DÍAS</span><h2>Embudo, demanda y asistencia</h2></div></div>
      <div className="reservation-funnel"><div><span>Visitas</span><strong>{metrics?.funnel.views || 0}</strong></div><i /><div><span>Inicios</span><strong>{metrics?.funnel.starts || 0}</strong></div><i /><div><span>Reservas</span><strong>{metrics?.funnel.completed || 0}</strong></div><div className="funnel-rate"><span>Conversión</span><strong>{metrics?.funnel.conversionRate ?? 0}%</strong></div></div>
      <div className="reservation-metric-grid reservation-metric-grid-six"><div><span>Reservas</span><strong>{total}</strong></div><div><span>Asistencia</span><strong>{total ? Math.round(attended / total * 100) : 0}%</strong></div><div><span>Cancelación</span><strong>{total ? Math.round(cancelled / total * 100) : 0}%</strong></div><div><span>No show</span><strong>{noShow}</strong></div><div><span>Lista de espera</span><strong>{waitlist}</strong></div><div><span>Pendientes</span><strong>{Number(metrics?.totals.pending || 0)}</strong></div></div>
      <div className="reservation-operations-map"><div className="reservation-section-head"><div><span className="page-eyebrow">MAPA DE OCUPACIÓN</span><h3>Calendario operacional, últimos 30 días</h3></div><p>Intensidad según reservas reales</p></div><div className="reservation-heatmap">{Array.from({ length: 30 }, (_, index) => { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - 29 + index); const key = date.toISOString().slice(0, 10); const count = dailyTotals[key] || 0; return <div key={key} title={`${date.toLocaleDateString('es-CL')}: ${count} reserva(s)`} style={{ '--heat': String(count / maxDailyTotal) } as React.CSSProperties}><span>{date.getDate()}</span><small>{date.toLocaleDateString('es-CL', { weekday: 'short' }).slice(0, 2)}</small><strong>{count}</strong></div>; })}</div><footer><span>Baja demanda</span><i /><i /><i /><i /><span>Alta demanda</span></footer></div>
      <div className="reservation-analytics"><div><h3>Origen y campaña</h3>{metrics?.sources.length ? metrics.sources.map((source) => <div className="source-row" key={`${source.source}-${source.campaign}`}><div><strong>{source.campaign}</strong><small>{source.source}</small></div><span>{source.total} reservas</span><em>{source.attended} asistencias</em></div>) : <p className="page-subtitle">Aún no hay atribución registrada.</p>}</div><div><h3>Horas más demandadas</h3><div className="hour-chart">{Array.from({ length: 12 }, (_, index) => index + 8).map((hour) => { const count = (metrics?.daily || []).filter((entry) => Number(entry.hour) === hour).reduce((sum, entry) => sum + Number(entry.total), 0); const max = Math.max(...(metrics?.daily || []).map((entry) => Number(entry.total)), 1); return <div key={hour} title={`${count} reserva(s) a las ${hour}:00`}><i style={{ height: `${Math.max(count / max * 100, 3)}%` }} /><span>{hour}:00</span></div>; })}</div></div></div>
    </section>}

    {tab === 'coupons' && <section>
      <div className="reservation-section-head"><div><span className="page-eyebrow">CUPONES</span><h2>Gestión de cupones</h2></div><button className="btn btn-outline btn-sm" onClick={() => setCouponTab('create')}>+ Nuevo cupón</button></div>
      {couponTab === 'create' ? <form className="modal-form" onSubmit={(event) => { event.preventDefault(); couponCreate.mutate(); }}><h3>Nuevo cupón</h3><label>Código<input className="input" required value={couponForm.code} onChange={(event) => setCouponForm({ ...couponForm, code: event.target.value })} placeholder="Ej. BIENVENIDA20" /></label><div className="form-row"><label>Tipo<select className="input" value={couponForm.discountType} onChange={(event) => setCouponForm({ ...couponForm, discountType: event.target.value })}><option value="percentage">Porcentaje</option><option value="fixed">Fijo</option></select></label><label>Valor<input className="input" type="number" min="0" value={couponForm.value} onChange={(event) => setCouponForm({ ...couponForm, value: Number(event.target.value) })} /></label></div><div className="form-row"><label>Usos máximos (0 = ilimitado)<input className="input" type="number" min="0" value={couponForm.maxUses} onChange={(event) => setCouponForm({ ...couponForm, maxUses: Number(event.target.value) })} /></label></div><div className="form-row"><label>Válido desde<input className="input" type="date" value={couponForm.validFrom} onChange={(event) => setCouponForm({ ...couponForm, validFrom: event.target.value })} /></label><label>Válido hasta<input className="input" type="date" value={couponForm.validUntil} onChange={(event) => setCouponForm({ ...couponForm, validUntil: event.target.value })} /></label></div><label>Formularios donde aplica (IDs separados por coma, opcional)<input className="input" value={couponForm.formIds} onChange={(event) => setCouponForm({ ...couponForm, formIds: event.target.value })} placeholder="Dejar vacío = todos" /></label>{couponCreate.error && <div className="alert alert-error">{couponCreate.error.message}</div>}<div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setCouponTab('list')}>Cancelar</button><button className="btn btn-primary" disabled={couponCreate.isPending}>{couponCreate.isPending ? 'Guardando...' : 'Crear cupón'}</button></div></form> : <div>
      <div className="reservation-filters"><input className="input" type="search" placeholder="Buscar por código" /></div>
      {coupons.length === 0 ? <div className="reservation-empty"><strong>Sin cupones todavía</strong><p>Crea tu primer cupón promocional.</p></div> : <div className="crm-table-container"><table className="data-table"><thead><tr><th>Código</th><th>Descuento</th><th>Usos</th><th>Vigencia</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{coupons.map((coupon) => <tr key={coupon.id}><td><strong>{coupon.code}</strong><small>Creado {new Date(coupon.createdAt).toLocaleDateString('es-CL')}</small></td><td>{coupon.discountType === 'percentage' ? `${coupon.value}%` : `$${coupon.value.toLocaleString('es-CL')}`}</td><td>{coupon.usageCount}/{coupon.maxUses || '∞'}</td><td>{coupon.validFrom ? `${new Date(coupon.validFrom).toLocaleDateString('es-CL')} - ${coupon.validUntil ? new Date(coupon.validUntil).toLocaleDateString('es-CL') : '∞'}` : 'Sin fecha'}</td><td><span className={`crm-stage is-${coupon.active ? 'attended' : 'cancelled_business'}`}>{coupon.active ? 'Activo' : 'Inactivo'}</span></td><td><div className="actions-cell"><button className="btn btn-outline btn-sm" onClick={() => couponToggle.mutate({ id: coupon.id, active: !coupon.active })}>{coupon.active ? 'Desactivar' : 'Activar'}</button><button className="btn btn-outline btn-sm" onClick={() => setViewingCouponCode(coupon.code)}>Ver usos</button></div></td></tr>)}</tbody></table></div>}
      {viewingCouponCode && <div className="coupon-usages"><div className="reservation-section-head"><div><span className="page-eyebrow">USOS DE {viewingCouponCode}</span><h3>Reservas que usaron este cupón</h3></div><button className="btn btn-outline btn-sm" onClick={() => setViewingCouponCode('')}>Cerrar</button></div>{couponUsages.length === 0 ? <p className="page-subtitle">Sin usos registrados.</p> : <div className="booking-list">{couponUsages.map((item) => <article className="booking-row" key={item.id}><div className="booking-date"><strong>{new Date(item.startsAt).getDate()}</strong><span>{new Date(item.startsAt).toLocaleDateString('es-CL', { month: 'short' })}</span></div><div className="booking-guest"><strong>{item.guestName}</strong><span>{item.guestPhone || item.guestEmail || '-'}</span><small>#{item.referenceCode}</small></div><StatusBadge status={item.status} /></article>)}</div>}</div>}
      </div>}
    </section>}

    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo formulario o encuesta"><form className="modal-form" onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}><p className="page-subtitle">Todos los tipos incluyen constructor visual drag and drop, diseño, enlace público y recopilación de respuestas. Define primero a quién pertenece.</p><label>Empresa o cliente<select className="input" required value={formData.clientId} onChange={(event) => setFormData({ ...formData, clientId: event.target.value })}><option value="">Selecciona un cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Nombre del formulario<input className="input" required value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="Ej. Evaluación inicial" /></label><label>Tipo de captura<select className="input" value={formData.mode} onChange={(event) => setFormData({ ...formData, mode: event.target.value })}><option value="appointment">Reserva con hora individual</option><option value="group">Inscripción con cupos grupales</option><option value="request">Formulario o encuesta sin confirmación automática</option></select></label>{createMutation.error && <div className="alert alert-error">{createMutation.error.message}</div>}<button className="btn btn-primary btn-block" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creando...' : 'Crear y abrir constructor'}</button></form></Modal>

    <Modal open={manualOpen} onClose={() => setManualOpen(false)} title="Agregar reserva manual"><form className="modal-form" onSubmit={(event) => { event.preventDefault(); manualMutation.mutate(); }}><p className="page-subtitle">Crea una reserva desde el equipo. Puedes forzar la superposición solo si marcas la casilla correspondiente.</p><label>Formulario<select className="input" required value={manualForm.formId} onChange={(event) => setManualForm({ ...manualForm, formId: event.target.value })}><option value="">Selecciona formulario</option>{forms.map((form) => <option key={form.id} value={form.id}>{form.name}</option>)}</select></label><label>Fecha y hora (local del formulario)<input className="input" type="datetime-local" required value={manualForm.startsAt} onChange={(event) => setManualForm({ ...manualForm, startsAt: event.target.value })} /></label><label>Nombre del visitante<input className="input" required value={manualForm.guestName} onChange={(event) => setManualForm({ ...manualForm, guestName: event.target.value })} /></label><div className="form-row"><label>Teléfono<input className="input" value={manualForm.guestPhone} onChange={(event) => setManualForm({ ...manualForm, guestPhone: event.target.value })} /></label><label>Correo<input className="input" type="email" value={manualForm.guestEmail} onChange={(event) => setManualForm({ ...manualForm, guestEmail: event.target.value })} /></label></div><label>Número de personas<input className="input" type="number" min="1" value={manualForm.partySize} onChange={(event) => setManualForm({ ...manualForm, partySize: Number(event.target.value) })} /></label><label>Notas internas<textarea className="input" rows={3} value={manualForm.internalNotes} onChange={(event) => setManualForm({ ...manualForm, internalNotes: event.target.value })} /></label><label className="toggle-row"><input type="checkbox" checked={manualForm.skipAvailability} onChange={(event) => setManualForm({ ...manualForm, skipAvailability: event.target.checked })} /> Permitir superposición manual (ignorar disponibilidad)</label>{manualMutation.error && <div className="alert alert-error">{manualMutation.error.message}</div>}<div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setManualOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={manualMutation.isPending}>{manualMutation.isPending ? 'Guardando...' : 'Crear reserva'}</button></div></form></Modal>

    <Modal open={Boolean(selectedBooking)} onClose={() => { setSelectedBooking(null); setRescheduleAt(''); }} title={selectedBooking ? `Reserva #${selectedBooking.referenceCode}` : 'Reserva'}>{selectedBooking && <div className="booking-detail"><div className="booking-detail-grid"><div><span>Visitante</span><strong>{selectedBooking.guestName}</strong></div><div><span>Contacto</span><strong>{selectedBooking.guestPhone || selectedBooking.guestEmail || 'Sin contacto'}</strong></div><div><span>Fecha actual</span><strong>{new Date(selectedBooking.startsAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short', timeZone: forms.find((form) => form.id === selectedBooking.formId)?.timezone })}</strong></div><div><span>Estado</span><StatusBadge status={selectedBooking.status} /></div></div>{selectedBooking.answers && Object.keys(selectedBooking.answers).length > 0 && <section className="booking-answers"><h4>Datos recopilados</h4><div>{Object.entries(selectedBooking.answers).map(([label, value]) => <article key={label}><span>{label}</span><strong>{Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value || 'Sin respuesta')}</strong></article>)}</div></section>}{['pending', 'confirmed', 'rescheduled', 'waitlist'].includes(selectedBooking.status) && <div className="booking-quick-actions"><form className="reschedule-form" onSubmit={(event) => { event.preventDefault(); updateMutation.mutate({ id: selectedBooking.id, body: { startsAt: localInputToUtc(rescheduleAt, forms.find((form) => form.id === selectedBooking.formId)?.timezone || 'America/Santiago') } }); }}><label>Reagendar a una nueva fecha y hora<input className="input" type="datetime-local" required value={rescheduleAt} onChange={(event) => setRescheduleAt(event.target.value)} /></label><button className="btn btn-outline btn-sm" disabled={updateMutation.isPending}>Validar y reagendar</button></form><div className="attendance-actions"><strong>Marcar asistencia</strong><button type="button" className="btn btn-primary btn-sm" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: selectedBooking.id, body: { status: 'attended' } })}>Asistió</button><button type="button" className="btn btn-outline btn-danger btn-sm" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: selectedBooking.id, body: { status: 'no_show' } })}>No asistió</button></div></div>}<h4>Historial trazable</h4>{historyLoading ? <p className="page-subtitle">Cargando historial...</p> : <div className="reservation-history">{history.map((event) => <div key={event.id}><span>{event.type === 'created' ? 'Reserva creada' : event.type === 'rescheduled' ? 'Reserva reagendada' : event.type === 'integration_failed' ? 'Integración pendiente' : 'Estado actualizado'}</span><small>{new Date(event.createdAt).toLocaleString('es-CL')} · {event.actorType}</small>{event.fromStatus || event.toStatus ? <em>{event.fromStatus ? STATUS_LABELS[event.fromStatus] || event.fromStatus : 'Inicio'} → {event.toStatus ? STATUS_LABELS[event.toStatus] || event.toStatus : ''}</em> : null}</div>)}</div>}<h4>Notas internas</h4><div className="booking-notes"><textarea className="input" rows={3} value={bookingNotes} onChange={(event) => setBookingNotes(event.target.value)} placeholder="Comentarios solo para el equipo..." /><button type="button" className="btn btn-outline btn-sm" disabled={bookingNotes === (selectedBooking.internalNotes || '') || updateMutation.isPending} onClick={() => updateMutation.mutate({ id: selectedBooking.id, body: { internalNotes: bookingNotes.trim() } })}>{updateMutation.isPending ? 'Guardando...' : 'Guardar notas'}</button></div>{updateMutation.error && <div className="alert alert-error">{updateMutation.error.message}</div>}</div>}</Modal>
  </div>;
}
