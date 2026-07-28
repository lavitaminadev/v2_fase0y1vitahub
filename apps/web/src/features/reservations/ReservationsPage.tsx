import { Fragment, useDeferredValue, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../core/api';
import { Modal } from '../../shared/Modal';
import { StatusBadge } from '../../shared/StatusBadge';
import { StatusTrafficLight } from '../../shared/StatusTrafficLight';
import { RESERVATION_STATUS_OPTIONS, findStatusOption } from '../../shared/status-palette';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { EmptyState } from '../../shared/EmptyState';
import { triggerToast } from '../../shared/Toast';
import { attendanceRateOf } from '../../shared/attendance';
import type { MetaConversionStatus, Reservation, ReservationForm } from './types';
import { localInputToUtc } from './local-time';
import { publicReservationUrl } from '../../core/public-url';
import { useAuth } from '../../core/auth';
import { ExportModal } from './ExportModal';
import { ReservationResults } from '../dashboard/ReservationResults';
import { safeUrl } from '../../core/safe-url';

interface Client { id: string; name: string }
interface PixelBinding { clientId: string; pixelId: string | null; pixelName: string | null; tokenConfigured: boolean }

/**
 * Resume en una etiqueta si un formulario está en condiciones de reportar conversiones.
 *
 * Combina el interruptor del propio formulario con la configuración de Pixel del cliente,
 * de modo que la lista muestre el estado sin necesidad de abrir cada formulario.
 *
 * @param form - Formulario de reserva.
 * @param binding - Pixel y token asociados a su cliente, si existen.
 * @returns Tono, etiqueta y descripción larga para el atributo `title`.
 */
function metaReadiness(form: ReservationForm, binding?: PixelBinding): { tone: 'ok' | 'warn' | 'off'; label: string; title: string } {
  if (!form.metaCapiEnabled) {
    return { tone: 'off', label: 'Meta apagado', title: 'Este formulario no envía conversiones a Meta.' };
  }
  if (!binding?.pixelId) {
    return { tone: 'warn', label: 'Sin Pixel', title: 'Meta está activado pero el cliente no tiene Pixel asociado: no se enviará ninguna conversión.' };
  }
  if (!binding.tokenConfigured) {
    return { tone: 'warn', label: 'Falta token', title: `Pixel ${binding.pixelId} asociado, pero sin token de Conversions API: los eventos quedarán en cola sin enviarse.` };
  }
  return { tone: 'ok', label: 'Pixel listo', title: `Enviando conversiones al Pixel ${binding.pixelName || binding.pixelId}.` };
}
interface ReservationPage { items: Reservation[]; total: number; page: number; pageSize: number; pages: number }
interface ReservationEvent { id: string; type: string; fromStatus?: string; toStatus?: string; actorType: string; metadata?: Record<string, string>; createdAt: string }

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmada', attended: 'Asistió', no_show: 'No asistió',
  rescheduled: 'Reagendada', cancelled_client: 'Cancelada por cliente',
  cancelled_business: 'Cancelada por empresa', waitlist: 'Lista de espera',
};
const MODE_LABELS: Record<string, string> = { appointment: 'Reserva', group: 'Reserva grupal', request: 'Solicitud manual' };

/** Estados que resumen el dia operativo: lo pendiente, lo confirmado y como cerro el ciclo. */
const BOOKING_TILE_STATUSES = ['pending', 'confirmed', 'attended', 'no_show'];

/** Estados en los que la asistencia aun no se registra y los botones directos tienen sentido. */
const ATTENDANCE_PENDING = ['pending', 'confirmed', 'rescheduled', 'waitlist'];

/**
 * Traduce el estado del envio a Meta a algo accionable para el equipo.
 *
 * Lo que importa del brief es doble: que el evento haya llegado y que lleve datos de
 * coincidencia. Una reserva enviada sin identificadores cuenta como conversion perdida,
 * asi que se marca en ambar aunque el envio haya sido correcto.
 */
function metaConversionChip(conversion?: MetaConversionStatus): { tone: 'ok' | 'warn' | 'off' | 'error'; label: string; title: string } | null {
  if (!conversion) return null;
  const { schedule, attended, matchFields } = conversion;
  if (!schedule && !attended) return { tone: 'off', label: 'Meta —', title: 'Esta reserva todavía no generó eventos de conversión.' };
  if (schedule === 'expired' || attended === 'expired') {
    return { tone: 'error', label: 'Fuera de ventana', title: 'El evento superó los 7 días que acepta Meta: esta conversión ya no puede atribuirse a la campaña.' };
  }
  if (schedule === 'failed' || attended === 'failed') {
    return { tone: 'error', label: 'Meta falló', title: 'El envío a Meta falló. Revisa Integraciones para reintentar.' };
  }
  const pending = [schedule, attended].some((status) => status && status !== 'processed');
  const sent = [schedule, attended].filter((status) => status === 'processed').length;
  if (matchFields === 0) {
    return { tone: 'warn', label: 'Sin coincidencia', title: 'El evento salió sin teléfono, correo ni identificadores de clic: Meta no puede atribuirlo a la campaña.' };
  }
  if (pending) return { tone: 'warn', label: 'Meta en cola', title: `Envío pendiente. ${matchFields} datos de coincidencia.` };
  return { tone: 'ok', label: attended ? 'Meta ✓ asistió' : 'Meta ✓', title: `${sent} evento(s) confirmados con ${matchFields} datos de coincidencia.` };
}

export function ReservationsPage({ clientView = false }: { clientView?: boolean }) {
  const user = useAuth((state) => state.user);
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
  const [couponCreateOpen, setCouponCreateOpen] = useState(false);
  const [couponForm, setCouponForm] = useState({ code: '', discountType: 'percentage', value: 0, maxUses: 0, validFrom: '', validUntil: '', formIds: '', validDaysOfWeek: [] as number[], validFromTime: '', validUntilTime: '' });
  const [couponSearch, setCouponSearch] = useState('');
  const [viewingCouponCode, setViewingCouponCode] = useState('');
  const [confirmCoupon, setConfirmCoupon] = useState<{ id: string; active: boolean } | null>(null);
  const [confirmFormAction, setConfirmFormAction] = useState<{ id: string; action: 'duplicate' | 'pause' | 'resume' } | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [clientFilter, setClientFilter] = useState(initialClientId);
  const [formData, setFormData] = useState({ clientId: initialClientId, name: '', mode: 'appointment' });
  const [formFilters, setFormFilters] = useState({ search: '', status: '' });
  const [filters, setFilters] = useState({ search: searchParams.get('search') ?? '', status: '', formId: '', from: '', to: '' });
  const search = useDeferredValue(filters.search.trim());

  const clientQuery = clientFilter ? `?clientId=${encodeURIComponent(clientFilter)}` : '';
  const { data: formsArray = [], isLoading, error: formsError, refetch: refetchForms, isFetching: fetchingForms } = useQuery<ReservationForm[]>({ queryKey: ['reservation-forms', clientFilter], queryFn: () => api.get(`/reservations/forms${clientQuery}`) });
  const forms = Array.isArray(formsArray) ? formsArray : [];
  const { data: clientsResp } = useQuery<{ data: Client[] }>({ queryKey: ['clients'], queryFn: () => api.get('/clients'), enabled: !clientView });
  const clients = Array.isArray((clientsResp as any)?.data) ? (clientsResp as any).data : [];
  // El catálogo de Pixels está restringido a administración, operaciones y dirección
  // comercial; el resto de los roles no ve la etiqueta de estado.
  const canReadPixels = !clientView && ['admin', 'operations_director', 'commercial_director'].includes(user?.role ?? '');
  const { data: pixelCatalog } = useQuery<{ bindings: PixelBinding[] }>({ queryKey: ['meta-client-pixels'], queryFn: () => api.get('/integrations/meta/client-pixels/catalog'), enabled: canReadPixels });
  const pixelByClient = new Map((pixelCatalog?.bindings ?? []).map((binding) => [binding.clientId, binding]));
  // `to` se envía al final del día para que el rango incluya la fecha elegida: el backend
  // compara contra `starts_at`, y una fecha suelta se interpreta como su medianoche.
  const dateRange = { ...(filters.from ? { from: filters.from } : {}), ...(filters.to ? { to: `${filters.to}T23:59:59` } : {}) };
  const query = new URLSearchParams({ page: String(page), pageSize: '20', ...(clientFilter ? { clientId: clientFilter } : {}), ...(search ? { search } : {}), ...(filters.status ? { status: filters.status } : {}), ...(filters.formId ? { formId: filters.formId } : {}), ...dateRange });
  const { data: bookingPage, isFetching: loadingBookings } = useQuery<ReservationPage>({ queryKey: ['reservations', page, clientFilter, search, filters.status, filters.formId, filters.from, filters.to], queryFn: () => api.get(`/reservations?${query}`), enabled: tab === 'bookings', placeholderData: (previous) => previous });
  const bookingsData = bookingPage?.items || [];
  const bookings = Array.isArray(bookingsData) ? bookingsData : [];
  // Los contadores ignoran el filtro de estado a proposito: son el resumen del dia sobre
  // el que se filtra, no el resultado del filtro.
  const { data: statusCounts = {}, isLoading: loadingCounts } = useQuery<Record<string, number>>({
    queryKey: ['reservation-status-counts', clientFilter, search, filters.formId, filters.from, filters.to],
    enabled: tab === 'bookings',
    queryFn: async () => {
      const totals = await Promise.all(BOOKING_TILE_STATUSES.map(async (status) => {
        const params = new URLSearchParams({ page: '1', pageSize: '1', status, ...(clientFilter ? { clientId: clientFilter } : {}), ...(search ? { search } : {}), ...(filters.formId ? { formId: filters.formId } : {}), ...dateRange });
        const result = await api.get(`/reservations?${params}`) as ReservationPage;
        return result?.total ?? 0;
      }));
      return Object.fromEntries(BOOKING_TILE_STATUSES.map((status, index) => [status, totals[index]]));
    },
  });
  const attendanceRate = attendanceRateOf(statusCounts.attended, statusCounts.no_show);
  const { data: historyData = [], isLoading: historyLoading } = useQuery<ReservationEvent[]>({ queryKey: ['reservation-history', selectedBooking?.id], queryFn: () => api.get(`/reservations/${selectedBooking!.id}/history`), enabled: Boolean(selectedBooking) });
  const history = Array.isArray(historyData) ? historyData : [];

  const createMutation = useMutation({
    mutationFn: () => api.post<ReservationForm>('/reservations/forms', formData),
    onSuccess: (created) => { qc.invalidateQueries({ queryKey: ['reservation-forms'] }); setCreateOpen(false); triggerToast('Formulario creado'); navigate(`/reservations/forms/${created.id}`); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { status?: string; startsAt?: string; internalNotes?: string } }) => api.patch<Reservation>(`/reservations/${id}`, body),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['reservation-metrics'] });
      qc.invalidateQueries({ queryKey: ['reservation-history', updated.id] });
      setSelectedBooking((current) => current?.id === updated.id ? updated : current);
      setRescheduleAt('');
      triggerToast('Reserva actualizada');
    },
  });
  const duplicateMutation = useMutation({ mutationFn: (id: string) => api.post(`/reservations/forms/${id}/duplicate`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['reservation-forms'] }); triggerToast('Formulario duplicado'); } });
  const updateFormMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch<ReservationForm>(`/reservations/forms/${id}`, { status }),
    onSuccess: (_data, vars) => { qc.invalidateQueries({ queryKey: ['reservation-forms'] }); triggerToast(vars.status === 'paused' ? 'Formulario pausado' : 'Formulario reanudado'); },
  });
  const [_exportError, _setExportError] = useState('');
  const manualMutation = useMutation({
    mutationFn: () => {
      const form = forms.find((f) => f.id === manualForm.formId);
      const body = {
        ...manualForm,
        startsAt: localInputToUtc(manualForm.startsAt, form?.timezone || 'America/Santiago'),
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
      triggerToast('Reserva manual creada');
    },
  });
  const { data: couponsData = [] } = useQuery<Array<{ id: string; code: string; discountType: string; value: number; maxUses: number; usageCount: number; validFrom?: string; validUntil?: string; formIds?: string[]; active: boolean; createdAt: string }>>({ queryKey: ['coupons', clientFilter], queryFn: () => api.get(`/reservations/coupons${clientQuery}`), enabled: tab === 'coupons' });
  const coupons = Array.isArray(couponsData) ? couponsData : [];
  const couponCreate = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { code: couponForm.code.trim(), discountType: couponForm.discountType, value: couponForm.value, maxUses: couponForm.maxUses };
      if (couponForm.validFrom) body.validFrom = new Date(couponForm.validFrom).toISOString();
      if (couponForm.validUntil) body.validUntil = new Date(couponForm.validUntil).toISOString();
      if (couponForm.formIds.trim()) body.formIds = couponForm.formIds.split(',').map((s) => s.trim()).filter(Boolean);
      if (couponForm.validDaysOfWeek.length > 0) body.validDaysOfWeek = couponForm.validDaysOfWeek;
      if (couponForm.validFromTime) body.validFromTime = couponForm.validFromTime;
      if (couponForm.validUntilTime) body.validUntilTime = couponForm.validUntilTime;
      return api.post('/reservations/coupons', body);
    },
    onSuccess: () => { setCouponForm({ code: '', discountType: 'percentage', value: 0, maxUses: 0, validFrom: '', validUntil: '', formIds: '', validDaysOfWeek: [], validFromTime: '', validUntilTime: '' }); setCouponCreateOpen(false); qc.invalidateQueries({ queryKey: ['coupons'] }); triggerToast('Cupón creado'); },
  });
  const couponToggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/reservations/coupons/${id}`, { active }),
    onSuccess: (_data, vars) => { qc.invalidateQueries({ queryKey: ['coupons'] }); triggerToast(vars.active ? 'Cupón activado' : 'Cupón desactivado'); },
  });
  const { data: couponUsagesData = [] } = useQuery<Reservation[]>({ queryKey: ['coupon-usages', viewingCouponCode], queryFn: () => api.get(`/reservations?couponCode=${encodeURIComponent(viewingCouponCode)}&pageSize=100`), enabled: Boolean(viewingCouponCode) });
  const couponUsages = Array.isArray(couponUsagesData) ? couponUsagesData : [];
  const filteredCoupons = coupons.filter((coupon) => {
    const needle = couponSearch.trim().toLocaleLowerCase('es');
    return !needle || coupon.code.toLocaleLowerCase('es').includes(needle);
  });

  if (isLoading) return <LoadingSpinner text="Preparando Reservas..." />;
  if (formsError) return <QueryErrorState title="No pudimos abrir Reservas y formularios" message={formsError.message} onRetry={() => void refetchForms()} retrying={fetchingForms} />;
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
    <nav className="reservation-tabs" aria-label="Secciones de reservas">
      {(clientView
        ? ([['forms', 'Mi agenda'], ['bookings', 'Mis reservas'], ['metrics', 'Resultados']] as const)
        : ([['forms', 'Formularios y encuestas'], ['bookings', 'Datos recopilados'], ['metrics', 'Analítica de reservas'], ['coupons', 'Cupones']] as const)
      ).map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}{key === 'bookings' && bookingPage?.total ? <span>{bookingPage.total}</span> : null}</button>)}
    </nav>

    {tab === 'forms' && <section>
      <div className="reservation-section-head"><div><span className="page-eyebrow">CENTRO DE CAPTURA</span><h1>Formularios, encuestas y agendas</h1></div><div className="reservation-actions"><p>{visibleForms.length} de {clientForms.length} activos visibles</p>{!clientView && <button className="btn reservation-cta" onClick={() => { setFormData((current) => ({ ...current, clientId: clientFilter })); setCreateOpen(true); }}>Crear formulario</button>}</div></div>
      <div className="reservation-status-summary" aria-label="Resumen de formularios"><button className={!formFilters.status ? 'active' : ''} onClick={() => setFormFilters((current) => ({ ...current, status: '' }))}><strong>{clientForms.length}</strong><span>Todos</span></button><button className={formFilters.status === 'published' ? 'active' : ''} onClick={() => setFormFilters((current) => ({ ...current, status: 'published' }))}><strong>{formCounts.published || 0}</strong><span>Publicados</span></button><button className={formFilters.status === 'paused' ? 'active' : ''} onClick={() => setFormFilters((current) => ({ ...current, status: 'paused' }))}><strong>{formCounts.paused || 0}</strong><span>Pausados</span></button><button className={formFilters.status === 'draft' ? 'active' : ''} onClick={() => setFormFilters((current) => ({ ...current, status: 'draft' }))}><strong>{formCounts.draft || 0}</strong><span>Borradores</span></button></div>
      <div className="reservation-form-filters"><input className="input" type="search" aria-label="Buscar formulario" placeholder="Buscar por nombre o enlace" value={formFilters.search} onChange={(event) => setFormFilters((current) => ({ ...current, search: event.target.value }))} />{!clientView && <select className="input" aria-label="Filtrar formularios por cliente" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}><option value="">Todos los clientes</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select>}<select className="input" aria-label="Filtrar formularios por estado" value={formFilters.status} onChange={(event) => setFormFilters((current) => ({ ...current, status: event.target.value }))}><option value="">Todos los estados</option><option value="published">Publicados</option><option value="paused">Pausados</option><option value="draft">Borradores</option></select><button type="button" className="btn btn-outline btn-sm" disabled={!formFilters.search && !formFilters.status && !clientFilter} onClick={() => { setFormFilters({ search: '', status: '' }); setClientFilter(''); }}>Limpiar</button><span className="filter-result-count">{visibleForms.length} formulario{visibleForms.length === 1 ? '' : 's'}</span></div>
      {visibleForms.length === 0 ? <div className="reservation-empty"><strong>Crea tu primera experiencia de reserva</strong><p>Configura campos, agenda y diseño.</p>{!clientView && <button className="btn btn-primary" onClick={() => { setFormData((current) => ({ ...current, clientId: clientFilter })); setCreateOpen(true); }}>Comenzar creación guiada</button>}</div> : <div className="reservation-form-grid">
        {visibleForms.map((form) => <article className="reservation-form-card" key={form.id}>
          <div className="form-card-accent" style={{ background: form.designConfig.primaryColor || '#173f35' }} />
          <div className="form-card-head"><span className="form-mode">{MODE_LABELS[form.mode] ?? form.mode}</span><StatusBadge status={form.status} /></div>
          <h2>{form.name}</h2><p>{formPublicUrl(form)}</p>{!clientView && <small className="form-client-name">{clients.find((client) => client.id === form.clientId)?.name || 'Cliente no disponible'}</small>}
          {canReadPixels && (() => { const readiness = metaReadiness(form, pixelByClient.get(form.clientId)); return <span className={`meta-readiness is-${readiness.tone}`} title={readiness.title}>{readiness.label}</span>; })()}
          <div className="form-card-facts"><span>{form.durationMinutes} min</span><span>{form.capacityPerSlot} cupo(s)</span><span>{form.fieldSchema.length} campos</span></div>
          <div className="form-card-actions"><Link className="btn btn-primary btn-sm" to={formPath(form.id)}>{clientView ? 'Configurar agenda' : 'Editar diseño y flujo'}</Link>{safeUrl(formPublicUrl(form)) ? <a className="btn btn-outline btn-sm" href={safeUrl(formPublicUrl(form))} target="_blank" rel="noreferrer">Abrir enlace</a> : null}{!clientView && <button className="btn btn-outline btn-sm" disabled={duplicateMutation.isPending} onClick={() => setConfirmFormAction({ id: form.id, action: 'duplicate' })}>{duplicateMutation.isPending ? 'Duplicando...' : 'Duplicar'}</button>}<button className="btn btn-outline btn-sm" onClick={() => backupForm(form)}>Respaldar JSON</button>{!clientView && form.status !== 'draft' && <button className="btn btn-outline btn-sm" disabled={updateFormMutation.isPending} onClick={() => form.status === 'paused' ? updateFormMutation.mutate({ id: form.id, status: 'published' }) : setConfirmFormAction({ id: form.id, action: 'pause' })}>{updateFormMutation.isPending ? 'Procesando...' : form.status === 'paused' ? 'Reanudar' : 'Pausar'}</button>}</div>
        </article>)}
      </div>}
    </section>}

    {tab === 'bookings' && <section>
      <div className="reservation-section-head"><div><span className="page-eyebrow">OPERACIÓN DIARIA</span><h1>Lista de reservas</h1></div><div className="reservation-actions">{!clientView && <button className="btn btn-outline btn-sm" onClick={() => setManualOpen(true)}>Agregar reserva manual</button>}<button className="btn btn-outline btn-sm" onClick={() => setExportModalOpen(true)}>Exportar datos</button></div></div>
      <div className="status-tiles" role="group" aria-label="Filtrar por estado del ciclo de reserva">
        {BOOKING_TILE_STATUSES.map((status) => { const option = findStatusOption(RESERVATION_STATUS_OPTIONS, status); return <button
          key={status}
          type="button"
          className={`status-tile ${filters.status === status ? 'is-active' : ''}`}
          style={{ '--tile-color': option?.color } as React.CSSProperties}
          aria-pressed={filters.status === status}
          onClick={() => resetFilters({ status: filters.status === status ? '' : status })}
        >
          <span className="status-tile-label">{option?.label ?? status}</span>
          <strong>{loadingCounts ? '—' : statusCounts[status] ?? 0}</strong>
          {status === 'attended' && attendanceRate !== null
            ? <small>{attendanceRate}% de asistencia</small>
            : <small>{filters.status === status ? 'Filtro activo' : 'Ver solo estos'}</small>}
        </button>; })}
      </div>
      <div className="reservation-filters"><input className="input" aria-label="Buscar reservas" placeholder="Buscar nombre, teléfono, correo o código" value={filters.search} onChange={(event) => resetFilters({ search: event.target.value })} /><select className="input" aria-label="Filtrar por formulario" value={filters.formId} onChange={(event) => resetFilters({ formId: event.target.value })}><option value="">Todos los formularios</option>{forms.map((form) => <option value={form.id} key={form.id}>{form.name}</option>)}</select><select className="input" aria-label="Filtrar por estado" value={filters.status} onChange={(event) => resetFilters({ status: event.target.value })}><option value="">Todos los estados</option>{Object.entries(STATUS_LABELS).map(([status, label]) => <option value={status} key={status}>{label}</option>)}</select>{!clientView && <select className="input" aria-label="Filtrar reservas por cliente" value={clientFilter} onChange={(event) => { setClientFilter(event.target.value); setPage(1); }}><option value="">Todos los clientes</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select>}<label className="filter-date">Desde<input className="input" type="date" aria-label="Reservas desde" value={filters.from} max={filters.to || undefined} onChange={(event) => resetFilters({ from: event.target.value })} /></label><label className="filter-date">Hasta<input className="input" type="date" aria-label="Reservas hasta" value={filters.to} min={filters.from || undefined} onChange={(event) => resetFilters({ to: event.target.value })} /></label><button type="button" className="btn btn-outline btn-sm" onClick={() => { const today = new Date(); const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; resetFilters({ from: key, to: key }); }}>Hoy</button><button type="button" className="btn btn-outline btn-sm" disabled={!filters.search && !filters.formId && !filters.status && !filters.from && !filters.to && !clientFilter} onClick={() => { resetFilters({ search: '', formId: '', status: '', from: '', to: '' }); setClientFilter(''); }}>Limpiar</button><span className="filter-result-count">{bookingPage?.total ?? 0} reserva{bookingPage?.total === 1 ? '' : 's'}</span></div>
      {loadingBookings && !bookingPage ? <LoadingSpinner text="Buscando reservas..." /> : bookings.length === 0 ? <div className="reservation-empty"><strong>Sin reservas para estos filtros</strong><p>Las nuevas solicitudes aparecerán aquí en tiempo real.</p></div> : <div className="booking-list">
        {bookings.map((item) => {
          return <article className="booking-row" key={item.id}>
          <div className="booking-date"><strong>{new Date(item.startsAt).getDate()}</strong><span>{new Date(item.startsAt).toLocaleDateString('es-CL', { month: 'short' })}</span><small>{new Date(item.startsAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</small></div>
          <button className="booking-guest booking-guest-button" onClick={() => { setSelectedBooking(item); setBookingNotes(item.internalNotes || ''); }}><strong>{item.guestName}</strong><span>{item.guestPhone || item.guestEmail || 'Sin contacto'}</span><small>#{item.referenceCode} · {item.utmCampaign || item.utmSource || 'Origen directo'}{item.couponCode ? <em className="booking-coupon">🎫 {item.couponCode}</em> : null}</small></button>
          <div className="booking-status-cell">
            {/* El gesto del dia es marcar asistencia: dos botones directos, sin desplegable.
                El resto del ciclo queda en el semaforo, que se usa mucho menos. */}
            {!clientView && ATTENDANCE_PENDING.includes(item.status) && <div className="attendance-quick">
              <button
                type="button"
                className="btn btn-attended btn-sm"
                disabled={updateMutation.isPending}
                aria-label={`Marcar que ${item.guestName} asistió`}
                onClick={() => updateMutation.mutate({ id: item.id, body: { status: 'attended' } })}
              >✓ Asistió</button>
              <button
                type="button"
                className="btn btn-no-show btn-sm"
                disabled={updateMutation.isPending}
                aria-label={`Marcar que ${item.guestName} no asistió`}
                onClick={() => updateMutation.mutate({ id: item.id, body: { status: 'no_show' } })}
              >✕ No</button>
            </div>}
            <StatusTrafficLight
              status={item.status}
              label={item.guestName}
              onChange={(newStatus) => updateMutation.mutate({ id: item.id, body: { status: newStatus } })}
              disabled={updateMutation.isPending || clientView}
            />
            {!clientView && (() => { const chip = metaConversionChip(item.metaConversion); return chip ? <span className={`meta-conversion is-${chip.tone}`} title={chip.title}>{chip.label}</span> : null; })()}
          </div>
        </article>; })}
      </div>}
      {(bookingPage?.pages || 0) > 1 && <nav className="reservation-pagination" aria-label="Páginas de reservas"><button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button><span>Página {bookingPage?.page} de {bookingPage?.pages} · {bookingPage?.total} reservas</span><button className="btn btn-outline btn-sm" disabled={page >= (bookingPage?.pages || 1)} onClick={() => setPage((value) => value + 1)}>Siguiente</button></nav>}
    </section>}

    {tab === 'metrics' && <ReservationResults clientId={clientFilter || undefined} headingLevel={1} />}

    {tab === 'coupons' && <section>
      <div className="reservation-section-head"><div><span className="page-eyebrow">CUPONES</span><h1>Gestión de cupones</h1></div><button className="btn btn-outline btn-sm" onClick={() => setCouponCreateOpen(true)}>+ Nuevo cupón</button></div>
      <div className="reservation-filters"><input className="input" type="search" aria-label="Buscar cupón" placeholder="Buscar por código" value={couponSearch} onChange={(event) => setCouponSearch(event.target.value)} /></div>
      {filteredCoupons.length === 0 ? <div className="reservation-empty"><strong>Sin cupones todavía</strong><p>Crea tu primer cupón promocional.</p></div> : <Fragment><div className="coupon-stats"><div className="reservation-metric-grid reservation-metric-grid-four"><div><span>Total cupones</span><strong>{coupons.length}</strong></div><div><span>Activos</span><strong>{coupons.filter((c) => c.active).length}</strong></div><div><span>Usos totales</span><strong>{coupons.reduce((sum, c) => sum + c.usageCount, 0)}</strong></div><div><span>Tasa de uso</span><strong>{(() => { const activeCoupons = coupons.filter((c) => c.active).length; if (activeCoupons === 0) return 'Sin cupones activos'; const usedActiveCoupons = coupons.filter((c) => c.active && c.usageCount > 0).length; return `${Math.round((usedActiveCoupons / activeCoupons) * 100)}% activos usados`; })()}</strong></div></div></div><div className="crm-table-container"><table className="data-table"><thead><tr><th>Código</th><th>Descuento</th><th>Usos</th><th>Vigencia</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{filteredCoupons.map((coupon) => <tr key={coupon.id}><td><strong>{coupon.code}</strong><small>Creado {new Date(coupon.createdAt).toLocaleDateString('es-CL')}</small></td><td>{coupon.discountType === 'percentage' ? `${coupon.value}%` : `$${coupon.value.toLocaleString('es-CL')}`}</td><td>{coupon.usageCount}/{coupon.maxUses || '∞'}</td><td>{coupon.validFrom ? `${new Date(coupon.validFrom).toLocaleDateString('es-CL')} - ${coupon.validUntil ? new Date(coupon.validUntil).toLocaleDateString('es-CL') : '∞'}` : 'Sin fecha'}</td><td><span className={`crm-stage is-${coupon.active ? 'attended' : 'cancelled_business'}`}>{coupon.active ? 'Activo' : 'Inactivo'}</span></td><td><div className="actions-cell">               <button className="btn btn-outline btn-sm" onClick={() => coupon.active ? setConfirmCoupon({ id: coupon.id, active: false }) : couponToggle.mutate({ id: coupon.id, active: true })} disabled={couponToggle.isPending}>{coupon.active ? 'Desactivar' : 'Activar'}</button><button className="btn btn-outline btn-sm" onClick={() => setViewingCouponCode(coupon.code)}>Ver usos</button></div></td></tr>)}</tbody></table></div></Fragment>}
      {viewingCouponCode && <div className="coupon-usages"><div className="reservation-section-head"><div><span className="page-eyebrow">USOS DE {viewingCouponCode}</span><h2>Reservas que usaron este cupón</h2></div><button className="btn btn-outline btn-sm" onClick={() => setViewingCouponCode('')}>Cerrar</button></div>{couponUsages.length === 0 ? <EmptyState icon="🎫" title="Sin usos" description="Este cupón aún no ha sido utilizado en ninguna reserva." /> : <div className="booking-list">{couponUsages.map((item) => <article className="booking-row" key={item.id}><div className="booking-date"><strong>{new Date(item.startsAt).getDate()}</strong><span>{new Date(item.startsAt).toLocaleDateString('es-CL', { month: 'short' })}</span></div><div className="booking-guest"><strong>{item.guestName}</strong><span>{item.guestPhone || item.guestEmail || '-'}</span><small>#{item.referenceCode}</small></div><StatusBadge status={item.status} /></article>)}</div>}</div>}
    </section>}

    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo formulario o encuesta"><form className="modal-form" onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}><p className="page-subtitle">Constructor visual con enlace público y respuestas.</p><label>Empresa o cliente<select className="input" required value={formData.clientId} onChange={(event) => setFormData({ ...formData, clientId: event.target.value })}><option value="">Selecciona un cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Nombre del formulario<input className="input" required value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="Ej. Evaluación inicial" /></label><label>Tipo de captura<select className="input" value={formData.mode} onChange={(event) => setFormData({ ...formData, mode: event.target.value })}><option value="appointment">Reserva con hora individual</option><option value="group">Inscripción con cupos grupales</option><option value="request">Formulario o encuesta sin confirmación automática</option></select></label>{createMutation.error && <div className="alert alert-error">{createMutation.error.message}</div>}<button className="btn btn-primary btn-block" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creando...' : 'Crear y abrir constructor'}</button></form></Modal>

    <Modal open={couponCreateOpen} onClose={() => setCouponCreateOpen(false)} title="Nuevo cupón"><form className="modal-form" onSubmit={(event) => { event.preventDefault(); couponCreate.mutate(); }}><label>Código<input className="input" required value={couponForm.code} onChange={(event) => setCouponForm({ ...couponForm, code: event.target.value })} placeholder="Ej. BIENVENIDA20" /></label><div className="form-row"><label>Tipo<select className="input" value={couponForm.discountType} onChange={(event) => setCouponForm({ ...couponForm, discountType: event.target.value })}><option value="percentage">Porcentaje</option><option value="fixed">Fijo</option></select></label><label>Valor<input className="input" type="number" min="0" value={couponForm.value} onChange={(event) => setCouponForm({ ...couponForm, value: Number(event.target.value) })} /></label></div><label>Usos máximos (0 = ilimitado)<input className="input" type="number" min="0" value={couponForm.maxUses} onChange={(event) => setCouponForm({ ...couponForm, maxUses: Number(event.target.value) })} /></label><div className="form-row"><label>Válido desde<input className="input" type="date" value={couponForm.validFrom} onChange={(event) => setCouponForm({ ...couponForm, validFrom: event.target.value })} /></label><label>Válido hasta<input className="input" type="date" value={couponForm.validUntil} onChange={(event) => setCouponForm({ ...couponForm, validUntil: event.target.value })} /></label></div><label>Formularios donde aplica<small>Sin marcar ninguno, el cupón vale para todos.</small><div className="coupon-form-picker">{forms.length === 0 ? <em>Aún no hay formularios.</em> : forms.map((form) => { const selected = couponForm.formIds.split(',').map((id) => id.trim()).filter(Boolean); const checked = selected.includes(form.id); return <label key={form.id} className="coupon-form-option"><input type="checkbox" checked={checked} onChange={(event) => { const next = event.target.checked ? [...selected, form.id] : selected.filter((id) => id !== form.id); setCouponForm({ ...couponForm, formIds: next.join(',') }); }} /><span>{form.name}</span></label>; })}</div></label><div className="form-row"><label>Válido desde la hora<small>De la reserva, no de cuándo se pide. Vacío = cualquier hora.</small><input className="input" type="time" value={couponForm.validFromTime} onChange={(event) => setCouponForm({ ...couponForm, validFromTime: event.target.value })} /></label><label>Válido hasta la hora<input className="input" type="time" value={couponForm.validUntilTime} onChange={(event) => setCouponForm({ ...couponForm, validUntilTime: event.target.value })} /></label></div><label>Días de la semana válidos (opcional, ninguno = todos)<div className="day-checkboxes">{['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((label, index) => { const jsDay = [1,2,3,4,5,6,0][index]; return <label key={index} className="day-checkbox"><input type="checkbox" checked={couponForm.validDaysOfWeek.includes(jsDay)} onChange={(event) => setCouponForm({ ...couponForm, validDaysOfWeek: event.target.checked ? [...couponForm.validDaysOfWeek, jsDay] : couponForm.validDaysOfWeek.filter((d) => d !== jsDay) })} />{label}</label>; })}</div></label>{couponCreate.error && <div className="alert alert-error">{couponCreate.error.message}</div>}<div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setCouponCreateOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={couponCreate.isPending}>{couponCreate.isPending ? 'Guardando...' : 'Crear cupón'}</button></div></form></Modal>

    <Modal open={manualOpen} onClose={() => setManualOpen(false)} title="Agregar reserva manual"><form className="modal-form" onSubmit={(event) => { event.preventDefault(); manualMutation.mutate(); }}><p className="page-subtitle">Registra una reserva manual con control de horario.</p><label>Formulario<select className="input" required value={manualForm.formId} onChange={(event) => setManualForm({ ...manualForm, formId: event.target.value })}><option value="">Selecciona formulario</option>{forms.map((form) => <option key={form.id} value={form.id}>{form.name}</option>)}</select></label><label>Fecha y hora (local del formulario)<input className="input" type="datetime-local" required value={manualForm.startsAt} onChange={(event) => setManualForm({ ...manualForm, startsAt: event.target.value })} /></label><label>Nombre del visitante<input className="input" required value={manualForm.guestName} onChange={(event) => setManualForm({ ...manualForm, guestName: event.target.value })} /></label><div className="form-row"><label>Teléfono<input className="input" value={manualForm.guestPhone} onChange={(event) => setManualForm({ ...manualForm, guestPhone: event.target.value })} /></label><label>Correo<input className="input" type="email" value={manualForm.guestEmail} onChange={(event) => setManualForm({ ...manualForm, guestEmail: event.target.value })} /></label></div><label>Número de personas<input className="input" type="number" min="1" value={manualForm.partySize} onChange={(event) => setManualForm({ ...manualForm, partySize: Number(event.target.value) })} /></label><label>Notas internas<textarea className="input" rows={3} value={manualForm.internalNotes} onChange={(event) => setManualForm({ ...manualForm, internalNotes: event.target.value })} /></label><label className="toggle-row"><input type="checkbox" checked={manualForm.skipAvailability} onChange={(event) => setManualForm({ ...manualForm, skipAvailability: event.target.checked })} /> Permitir superposición manual (ignorar disponibilidad)</label>{manualMutation.error && <div className="alert alert-error">{manualMutation.error.message}</div>}<div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setManualOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={manualMutation.isPending}>{manualMutation.isPending ? 'Guardando...' : 'Crear reserva'}</button></div></form></Modal>

    <Modal open={Boolean(selectedBooking)} onClose={() => { setSelectedBooking(null); setRescheduleAt(''); }} title={selectedBooking ? `Reserva #${selectedBooking.referenceCode}` : 'Reserva'}>{selectedBooking && <div className="booking-detail"><div className="booking-detail-grid"><div><span>Visitante</span><strong>{selectedBooking.guestName}</strong></div><div><span>Contacto</span><strong>{selectedBooking.guestPhone || selectedBooking.guestEmail || 'Sin contacto'}</strong></div><div><span>Fecha actual</span><strong>{new Date(selectedBooking.startsAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short', timeZone: forms.find((form) => form.id === selectedBooking.formId)?.timezone })}</strong></div><div><span>Estado</span><StatusBadge status={selectedBooking.status} /></div><div><span>Cupón aplicado</span><strong>{selectedBooking.couponCode ? <button type="button" className="link-button" onClick={() => { setTab('coupons'); setViewingCouponCode(selectedBooking.couponCode!); setSelectedBooking(null); }}>🎫 {selectedBooking.couponCode}</button> : 'Sin cupón'}</strong></div></div>{selectedBooking.answers && Object.keys(selectedBooking.answers).length > 0 && <section className="booking-answers"><h4>Datos recopilados</h4><div>{Object.entries(selectedBooking.answers).map(([label, value]) => <article key={label}><span>{label}</span><strong>{Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value || 'Sin respuesta')}</strong></article>)}</div></section>}{!clientView && ['pending', 'confirmed', 'rescheduled', 'waitlist'].includes(selectedBooking.status) && <div className="booking-quick-actions"><form className="reschedule-form" onSubmit={(event) => { event.preventDefault(); updateMutation.mutate({ id: selectedBooking.id, body: { startsAt: localInputToUtc(rescheduleAt, forms.find((form) => form.id === selectedBooking.formId)?.timezone || 'America/Santiago') } }); }}><label>Reagendar a una nueva fecha y hora<input className="input" type="datetime-local" required value={rescheduleAt} onChange={(event) => setRescheduleAt(event.target.value)} /></label><button className="btn btn-outline btn-sm" disabled={updateMutation.isPending}>Validar y reagendar</button></form><div className="attendance-actions"><strong>Marcar asistencia</strong><button type="button" className="btn btn-primary btn-sm" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: selectedBooking.id, body: { status: 'attended' } })}>Asistió</button><button type="button" className="btn btn-outline btn-danger btn-sm" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: selectedBooking.id, body: { status: 'no_show' } })}>No asistió</button></div></div>}<h4>Historial trazable</h4>{historyLoading ? <p className="page-subtitle">Cargando historial...</p> : <div className="reservation-history">{history.map((event) => <div key={event.id}><span>{event.type === 'created' ? 'Reserva creada' : event.type === 'rescheduled' ? 'Reserva reagendada' : event.type === 'integration_failed' ? 'Integración pendiente' : 'Estado actualizado'}</span><small>{new Date(event.createdAt).toLocaleString('es-CL')} · {event.actorType}</small>{event.fromStatus || event.toStatus ? <em>{event.fromStatus ? STATUS_LABELS[event.fromStatus] || event.fromStatus : 'Inicio'} → {event.toStatus ? STATUS_LABELS[event.toStatus] || event.toStatus : ''}</em> : null}</div>)}</div>}{!clientView && <><h4>Notas internas</h4><div className="booking-notes"><textarea className="input" rows={3} value={bookingNotes} onChange={(event) => setBookingNotes(event.target.value)} placeholder="Comentarios solo para el equipo..." /><button type="button" className="btn btn-outline btn-sm" disabled={bookingNotes === (selectedBooking.internalNotes || '') || updateMutation.isPending} onClick={() => updateMutation.mutate({ id: selectedBooking.id, body: { internalNotes: bookingNotes.trim() } })}>{updateMutation.isPending ? 'Guardando...' : 'Guardar notas'}</button></div></>}{updateMutation.error && <div className="alert alert-error">{updateMutation.error.message}</div>}</div>}</Modal>
    <ConfirmDialog open={Boolean(confirmCoupon)} title="Desactivar cupón" description="¿Desactivar este cupón? Las reservas existentes no se verán afectadas." confirmLabel="Desactivar" pending={couponToggle.isPending} onClose={() => setConfirmCoupon(null)} onConfirm={() => { if (confirmCoupon) couponToggle.mutate(confirmCoupon); setConfirmCoupon(null); }} />
    <ConfirmDialog open={Boolean(confirmFormAction)} title={confirmFormAction?.action === 'pause' ? 'Pausar formulario' : 'Duplicar formulario'} description={confirmFormAction?.action === 'pause' ? 'Al pausar el formulario, los visitantes verán un mensaje de mantenimiento. Las reservas existentes no se verán afectadas.' : 'Se creará una copia exacta de este formulario. ¿Quieres continuar?'} confirmLabel={confirmFormAction?.action === 'pause' ? 'Pausar' : 'Duplicar'} pending={confirmFormAction?.action === 'pause' ? updateFormMutation.isPending : duplicateMutation.isPending} onClose={() => setConfirmFormAction(null)} onConfirm={() => { if (!confirmFormAction) return; if (confirmFormAction.action === 'pause') updateFormMutation.mutate({ id: confirmFormAction.id, status: 'paused' }); else duplicateMutation.mutate(confirmFormAction.id); setConfirmFormAction(null); }} />

    <ExportModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} formId={filters.formId || undefined} clientView={clientView} />
  </div>;
}
