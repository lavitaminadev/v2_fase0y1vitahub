import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { DataTable } from '../../shared/DataTable';
import { StatusBadge } from '../../shared/StatusBadge';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { Modal } from '../../shared/Modal';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { matchesSearch } from '../../shared/search';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../core/auth';

interface ClientRecord {
  [key: string]: unknown;
  id: string;
  name: string;
  legalName?: string;
  industry?: string;
  status: string;
  retainerAmount?: number;
  currency?: string;
  defaultUdBudget: number;
  communityManagerId?: string;
  startedAt?: string;
  renewalAt?: string;
  whatsappGroup?: string;
  driveFolderId?: string;
  capabilities?: ClientCapabilities;
  createdAt: string;
}

interface ClientCapabilities {
  reservations: boolean;
  crm: boolean;
  metaConversions: boolean;
}

interface MetaPixelCatalog {
  bindings: Array<{ clientId: string; clientName: string; pixelId: string | null; pixelName: string | null; tokenConfigured: boolean; configuredAt: string | null }>;
  pixels: Array<{ pixelId: string; clientNames: string[]; pixelNames: string[]; usageCount: number; tokenConfigured: boolean }>;
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

interface ClientFormState {
  name: string;
  legalName: string;
  industry: string;
  communityManagerId: string;
  retainerAmount: string;
  currency: string;
  defaultUdBudget: string;
  status: string;
  startedAt: string;
  renewalAt: string;
  whatsappGroup: string;
  driveFolderId: string;
  capabilities: ClientCapabilities;
  pixelMode: 'none' | 'manual' | 'existing';
  pixelId: string;
  pixelName: string;
  pixelAccessToken: string;
  existingPixelId: string;
}

const EMPTY_FORM: ClientFormState = {
  name: '',
  legalName: '',
  industry: '',
  communityManagerId: '',
  retainerAmount: '',
  currency: 'CLP',
  defaultUdBudget: '20',
  status: 'onboarding',
  startedAt: '',
  renewalAt: '',
  whatsappGroup: '',
  driveFolderId: '',
  capabilities: { reservations: true, crm: true, metaConversions: false },
  pixelMode: 'none',
  pixelId: '',
  pixelName: '',
  pixelAccessToken: '',
  existingPixelId: '',
};

const CAPABILITY_OPTIONS: Array<{ key: keyof ClientCapabilities; label: string; description: string }> = [
  { key: 'reservations', label: 'Reservas', description: 'Agenda pública, disponibilidad, bloqueos y asistencia.' },
  { key: 'crm', label: 'CRM de reservas', description: 'Crea o actualiza el contacto cuando ingresa una reserva.' },
  { key: 'metaConversions', label: 'Meta Pixel + CAPI', description: 'Envía Schedule y Reserva_Asistida al Pixel de esta empresa.' },
];

export function ClientsPage() {
  const [searchParams] = useSearchParams();
  const user = useAuth((state) => state.user);
  const canManage = ['admin', 'commercial_director', 'operations_director'].includes(user?.role ?? '');
  const canViewManagers = [...(canManage ? [user?.role] : []), 'community_manager'].includes(user?.role);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(searchParams.get('create') === '1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientFormState>(EMPTY_FORM);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  // Bulk actions confirm before running; ConfirmDialog owns the "are you sure" step instead of window.confirm().
  const [pendingBulkStatus, setPendingBulkStatus] = useState<{ rows: ClientRecord[]; status: 'active' | 'paused' } | null>(null);
  const [bulkStatusPending, setBulkStatusPending] = useState(false);
  const queryClient = useQueryClient();

  const { data: clients, isLoading, error } = useQuery<ClientRecord[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
  });

  const { data: users } = useQuery<UserOption[]>({
    queryKey: ['client-manager-options'],
    queryFn: () => api.get('/clients/options/managers'),
    enabled: canViewManagers,
  });

  const { data: pixelCatalog } = useQuery<MetaPixelCatalog>({
    queryKey: ['meta-client-pixel-catalog'],
    queryFn: () => api.get('/integrations/meta/client-pixels/catalog'),
    enabled: canManage,
  });

  const configurePixel = async (clientId: string) => {
    const mode = form.capabilities.metaConversions ? form.pixelMode : 'none';
    await api.post('/integrations/meta/client-pixels/setup', {
      clientId,
      mode,
      pixelId: mode === 'manual' ? form.pixelId.trim() : undefined,
      pixelName: form.pixelName.trim() || undefined,
      accessToken: mode === 'manual' ? form.pixelAccessToken.trim() || undefined : undefined,
      existingPixelId: mode === 'existing' ? form.existingPixelId : undefined,
    });
  };

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const created = await api.post<ClientRecord>('/clients', body);
      let pixelWarning: string | null = null;
      try {
        await configurePixel(created.id);
      } catch (pixelError) {
        pixelWarning = pixelError instanceof Error ? pixelError.message : 'configuración inválida';
      }
      return { created, pixelWarning };
    },
    onSuccess: ({ created, pixelWarning }) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['meta-client-pixel-catalog'] });
      setFeedback({ tone: pixelWarning ? 'error' : 'success', text: pixelWarning ? `Cliente creado correctamente, pero Meta quedó en alerta: ${pixelWarning}` : 'Cliente creado correctamente.' });
      if (pixelWarning) {
        setEditingId(created.id);
        setModalOpen(true);
        return;
      }
      setModalOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const updated = await api.put<ClientRecord>(`/clients/${id}`, body);
      let pixelWarning: string | null = null;
      try {
        await configurePixel(id);
      } catch (pixelError) {
        pixelWarning = pixelError instanceof Error ? pixelError.message : 'configuración inválida';
      }
      return { updated, pixelWarning };
    },
    onSuccess: ({ pixelWarning }) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['meta-client-pixel-catalog'] });
      setFeedback({ tone: pixelWarning ? 'error' : 'success', text: pixelWarning ? `Ficha de cliente actualizada correctamente, pero Meta quedó en alerta: ${pixelWarning}` : 'Ficha de cliente actualizada correctamente.' });
      if (pixelWarning) {
        setModalOpen(true);
        return;
      }
      setModalOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const managerMap = useMemo(
    () => new Map((users ?? []).map((user) => [user.id, user.name])),
    [users],
  );

  const managerOptions = useMemo(
    () => (users ?? []).filter((user) => ['community_manager', 'operations_director'].includes(user.role)),
    [users],
  );

  const filtered = (clients ?? []).filter((client) => {
    const matchSearch = matchesSearch(search, [client.name, client.legalName, client.industry]);
    const matchStatus = !statusFilter || client.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = {
      name: form.name.trim(),
      legalName: form.legalName.trim() || undefined,
      industry: form.industry.trim() || undefined,
      communityManagerId: form.communityManagerId || (editingId ? null : undefined),
      retainerAmount: form.retainerAmount ? Number(form.retainerAmount) : undefined,
      currency: form.currency.trim() || undefined,
      defaultUdBudget: Number(form.defaultUdBudget),
      capabilities: form.capabilities,
      ...(editingId ? {
        status: form.status,
        startedAt: form.startedAt || undefined,
        renewalAt: form.renewalAt || undefined,
        whatsappGroup: form.whatsappGroup.trim() || undefined,
        driveFolderId: form.driveFolderId.trim() || undefined,
      } : {}),
    };
    if (editingId) updateMutation.mutate({ id: editingId, body });
    else createMutation.mutate(body);
  };

  const openCreate = () => {
    setFeedback(null);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (client: ClientRecord) => {
    setFeedback(null);
    setEditingId(client.id);
    const binding = pixelCatalog?.bindings.find((item) => item.clientId === client.id);
    setForm({
      name: client.name,
      legalName: client.legalName || '',
      industry: client.industry || '',
      communityManagerId: client.communityManagerId || '',
      retainerAmount: client.retainerAmount == null ? '' : String(client.retainerAmount),
      currency: client.currency || 'CLP',
      defaultUdBudget: String(client.defaultUdBudget ?? 20),
      status: client.status,
      startedAt: client.startedAt?.slice(0, 10) || '',
      renewalAt: client.renewalAt?.slice(0, 10) || '',
      whatsappGroup: client.whatsappGroup || '',
      driveFolderId: client.driveFolderId || '',
      capabilities: {
        reservations: client.capabilities?.reservations ?? true,
        crm: client.capabilities?.crm ?? true,
        metaConversions: client.capabilities?.metaConversions ?? Boolean(binding?.pixelId),
      },
      pixelMode: binding?.pixelId ? 'existing' : 'none',
      pixelId: binding?.pixelId || '',
      pixelName: binding?.pixelName || '',
      pixelAccessToken: '',
      existingPixelId: binding?.pixelId || '',
    });
    setModalOpen(true);
  };

  const bulkStatus = (rows: ClientRecord[], status: 'active' | 'paused') => {
    if (!canManage) return;
    setPendingBulkStatus({ rows, status });
  };

  const confirmBulkStatus = async () => {
    if (!pendingBulkStatus) return;
    const { rows, status } = pendingBulkStatus;
    setBulkStatusPending(true);
    try {
      await Promise.all(rows.map((row) => api.put(`/clients/${row.id}`, { status })));
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      setFeedback({ tone: 'success', text: `${rows.length} cliente(s) actualizados.` });
    } catch (bulkError) {
      setFeedback({ tone: 'error', text: bulkError instanceof Error ? bulkError.message : 'No se pudo completar la acción masiva.' });
    } finally {
      setBulkStatusPending(false);
      setPendingBulkStatus(null);
    }
  };

  if (isLoading) return <LoadingSpinner text="Cargando clientes..." />;
  if (error) return <div className="alert alert-error">Error al cargar clientes</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Clientes</h1>
        {canManage && <button className="btn btn-primary" onClick={openCreate}>+ Nuevo cliente</button>}
      </div>
      <div className="filters">
        <input className="input" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="onboarding">Onboarding</option>
          <option value="paused">Pausado</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>
      {feedback && <div className={`alert alert-${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.text}</div>}
      <DataTable<ClientRecord>
        storageKey="clients"
        exportFileName="clientes"
        selectable={canManage}
        bulkActions={canManage ? [{ label: 'Activar', onClick: (rows) => bulkStatus(rows, 'active') }, { label: 'Pausar', onClick: (rows) => bulkStatus(rows, 'paused') }] : []}
        columns={[
          { key: 'name', label: 'Nombre', sortable: true },
          { key: 'legalName', label: 'Razón social', sortable: true, render: (row) => row.legalName || '-' },
          { key: 'industry', label: 'Industria', sortable: true, render: (row) => row.industry || '-' },
          { key: 'status', label: 'Estado', render: (row) => <StatusBadge status={row.status} /> },
          {
            key: 'retainerAmount',
            label: 'Retainer',
            render: (row) => row.retainerAmount ? `${row.currency || 'CLP'} ${Number(row.retainerAmount).toLocaleString()}` : '-',
          },
          { key: 'defaultUdBudget', label: 'Presupuesto UD', sortable: true, render: (row) => String(row.defaultUdBudget ?? 0) },
          {
            key: 'communityManagerId',
            label: 'Responsable',
            render: (row) => row.communityManagerId ? managerMap.get(row.communityManagerId) ?? row.communityManagerId : '-',
          },
          {
            key: 'id',
            label: 'Acciones',
            render: (row) => (
              <div className="actions-cell">
                <Link className="btn btn-primary btn-sm" to={`/clients/${row.id}`}>Ver ficha 360</Link>
                {canManage && <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(row)}>Editar</button>}
              </div>
            ),
          },
        ]}
        data={filtered}
        keyExtractor={(row) => row.id}
        emptyMessage="No se encontraron clientes"
      />
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingId(null); }} title={editingId ? 'Editar cliente' : 'Nuevo cliente'}>
        <form onSubmit={handleSubmit}>
          {feedback?.tone === 'error' && <div className="alert alert-error" role="alert">{feedback.text}</div>}
          <div className="form-group">
            <label>Nombre comercial</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Razón social</label>
            <input className="input" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Industria</label>
            <input className="input" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          </div>
          <div className="form-row">
            {editingId && <div className="form-group">
              <label>Estado</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="onboarding">Onboarding</option><option value="active">Activo</option><option value="paused">Pausado</option><option value="cancelled">Cancelado</option></select>
            </div>}
            <div className="form-group">
              <label>Responsable</label>
              <select className="input" value={form.communityManagerId} onChange={(e) => setForm({ ...form, communityManagerId: e.target.value })}>
                <option value="">Sin asignar</option>
                {managerOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Moneda</label>
              <input className="input" maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Retainer</label>
              <input className="input" type="number" min="0" value={form.retainerAmount} onChange={(e) => setForm({ ...form, retainerAmount: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Presupuesto UD</label>
              <input className="input" type="number" min="0" value={form.defaultUdBudget} onChange={(e) => setForm({ ...form, defaultUdBudget: e.target.value })} />
            </div>
          </div>
          <section className="client-capabilities" aria-labelledby="client-capabilities-title">
            <div className="client-section-heading">
              <div>
                <span>CAPACIDADES DE LA EMPRESA</span>
                <h3 id="client-capabilities-title">Activa sólo lo que utilizará esta cuenta</h3>
              </div>
              <small>Este catálogo permite incorporar futuras funciones sin cambiar el alta de clientes.</small>
            </div>
            <div className="client-capability-grid">
              {CAPABILITY_OPTIONS.map((option) => {
                const enabled = form.capabilities[option.key];
                return <button
                  key={option.key}
                  type="button"
                  className={`client-capability-toggle ${enabled ? 'active' : ''}`}
                  aria-pressed={enabled}
                  onClick={() => setForm((current) => ({
                    ...current,
                    capabilities: { ...current.capabilities, [option.key]: !enabled },
                    ...(option.key === 'metaConversions' && enabled ? { pixelMode: 'none' as const } : {}),
                  }))}
                >
                  <span>{enabled ? '✓' : '+'}</span>
                  <div><strong>{option.label}</strong><small>{option.description}</small></div>
                  <em>{enabled ? 'Activo' : 'Inactivo'}</em>
                </button>;
              })}
            </div>
          </section>

          {form.capabilities.metaConversions && <section className="client-pixel-setup" aria-labelledby="client-pixel-title">
            <div className="client-section-heading">
              <div><span>META — FASE 1</span><h3 id="client-pixel-title">Pixel para las conversiones de reservas</h3></div>
              <small>El token queda cifrado y nunca se entrega al navegador público.</small>
            </div>
            <div className="pixel-mode-grid">
              {([
                ['none', 'Sin Pixel', 'Puedes configurarlo más adelante desde Editar empresa.'],
                ['manual', 'Agregar Pixel', 'Valida un Pixel ID con su token CAPI.'],
                ['existing', 'Usar existente', 'Reutiliza un Pixel ya validado en esta organización.'],
              ] as const).map(([mode, label, description]) => <button
                type="button"
                key={mode}
                className={form.pixelMode === mode ? 'active' : ''}
                aria-pressed={form.pixelMode === mode}
                onClick={() => setForm({ ...form, pixelMode: mode })}
              ><strong>{label}</strong><small>{description}</small></button>)}
            </div>
            {form.pixelMode === 'manual' && <div className="form-row">
              <div className="form-group"><label>Pixel ID</label><input className="input" inputMode="numeric" pattern="[0-9]+" value={form.pixelId} onChange={(event) => setForm({ ...form, pixelId: event.target.value.replace(/\D/g, '') })} required /></div>
              <div className="form-group"><label>Nombre del Pixel</label><input className="input" value={form.pixelName} onChange={(event) => setForm({ ...form, pixelName: event.target.value })} placeholder="Ej. Ads principal" required /></div>
              <div className="form-group"><label>Token de Conversions API</label><input className="input" type="password" autoComplete="new-password" value={form.pixelAccessToken} onChange={(event) => setForm({ ...form, pixelAccessToken: event.target.value })} placeholder={editingId ? 'Dejar vacío para conservar el actual' : 'Token generado en Events Manager'} required={!editingId} /></div>
            </div>}
            {form.pixelMode === 'existing' && <div className="form-group">
              <label>Pixel existente</label>
              <select className="input" value={form.existingPixelId} onChange={(event) => setForm({ ...form, existingPixelId: event.target.value })} required>
                <option value="">Seleccionar Pixel...</option>
                {(pixelCatalog?.pixels ?? []).map((pixel) => <option key={pixel.pixelId} value={pixel.pixelId}>{pixel.pixelNames[0] ? `${pixel.pixelNames[0]} · ` : ''}Pixel {pixel.pixelId} · {pixel.usageCount} empresa(s)</option>)}
              </select>
              <label className="field-help">Nombre visible del Pixel<input className="input" value={form.pixelName} onChange={(event) => setForm({ ...form, pixelName: event.target.value })} placeholder="Ej. Pixel principal" required /></label>
              <small className="field-help">Compartir un Pixel combina las señales de las empresas seleccionadas en Meta. Úsalo sólo cuando sea intencional.</small>
            </div>}
            {form.pixelMode === 'none' && <div className="alert alert-info">La empresa se guardará sin Meta. Reservas y CRM seguirán funcionando.</div>}
            {form.capabilities.metaConversions && form.pixelMode !== 'none' && (!form.pixelId && !form.existingPixelId) && <div className="alert alert-warning">Meta quedará en alerta hasta completar Pixel, nombre y token.</div>}
          </section>}
          {editingId && <>
            <div className="form-row">
              <div className="form-group"><label>Inicio de servicio</label><input className="input" type="date" value={form.startedAt} onChange={(e) => setForm({ ...form, startedAt: e.target.value })} /></div>
              <div className="form-group"><label>Próxima renovación</label><input className="input" type="date" value={form.renewalAt} onChange={(e) => setForm({ ...form, renewalAt: e.target.value })} /></div>
            </div>
            <div className="form-group"><label>Grupo de WhatsApp</label><input className="input" value={form.whatsappGroup} onChange={(e) => setForm({ ...form, whatsappGroup: e.target.value })} placeholder="Nombre o enlace operativo" /></div>
            <div className="form-group"><label>Carpeta principal de Google Drive</label><input className="input" value={form.driveFolderId} onChange={(e) => setForm({ ...form, driveFolderId: e.target.value })} placeholder="ID de la carpeta del cliente" /></div>
          </>}
          <button className="btn btn-primary btn-block" type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear cliente'}
          </button>
        </form>
      </Modal>
      <ConfirmDialog
        open={pendingBulkStatus !== null}
        title="Cambiar estado de clientes"
        description={pendingBulkStatus ? `Se cambiará el estado de ${pendingBulkStatus.rows.length} cliente(s) a "${pendingBulkStatus.status === 'active' ? 'activo' : 'pausado'}".` : ''}
        confirmLabel="Cambiar estado"
        pending={bulkStatusPending}
        onClose={() => setPendingBulkStatus(null)}
        onConfirm={() => void confirmBulkStatus()}
      />
    </div>
  );
}
