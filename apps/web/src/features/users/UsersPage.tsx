import { useDeferredValue, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { DataTable } from '../../shared/DataTable';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { Modal } from '../../shared/Modal';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { useSearchParams } from 'react-router-dom';

interface UserRow {
  [key: string]: unknown;
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  phone?: string;
  clientId?: string;
  workMode?: 'presential' | 'hybrid' | 'remote';
  mustChangePassword?: boolean;
  weeklyCapacityUd?: number;
  createdAt: string;
}

interface ClientOption {
  id: string;
  name: string;
  status: string;
}

interface UserFormState {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: string;
  clientId: string;
  workMode: string;
  weeklyCapacityUd: number;
}

const EMPTY_FORM: UserFormState = { name: '', email: '', password: '', phone: '', role: 'designer', clientId: '', workMode: 'hybrid', weeklyCapacityUd: 20 };

const USER_ROLES = [
  'admin', 'commercial_director', 'creative_director', 'operations_director', 'art_director',
  'av_director', 'ai_lead', 'community_manager', 'designer', 'audiovisual', 'client',
] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  commercial_director: 'Dirección comercial',
  creative_director: 'Dirección creativa',
  operations_director: 'Dirección de operaciones',
  art_director: 'Dirección de arte',
  av_director: 'Dirección audiovisual',
  ai_lead: 'Líder de automatización',
  community_manager: 'Community manager',
  designer: 'Diseño',
  audiovisual: 'Audiovisual',
  client: 'Cliente',
};

const WORK_MODE_LABELS: Record<string, string> = { presential: 'Presencial', hybrid: 'Híbrida', remote: 'Remota' };

interface ResetResult {
  userId: string;
  temporaryPassword: string;
  emailSent: boolean;
  mustChangePassword: boolean;
}

type Feedback = { tone: 'success' | 'error'; text: string } | null;

export function UsersPage() {
  const [searchParams] = useSearchParams();
  const currentUser = useAuth((state) => state.user);
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(searchParams.get('create') === '1');
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [accessTarget, setAccessTarget] = useState<UserRow | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetResult, setResetResult] = useState<ResetResult | null>(null);
  const [sendResetEmail, setSendResetEmail] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const deferredSearch = useDeferredValue(search.trim());
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [feedback, setFeedback] = useState<Feedback>(null);
  // Bulk actions confirm before running; ConfirmDialog owns the "are you sure" step instead of window.confirm().
  const [pendingBulkAccess, setPendingBulkAccess] = useState<{ rows: UserRow[]; isActive: boolean } | null>(null);
  const [bulkAccessPending, setBulkAccessPending] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (deferredSearch) params.set('q', deferredSearch);
    if (roleFilter) params.set('role', roleFilter);
    if (statusFilter) params.set('isActive', statusFilter);
    if (clientFilter) params.set('clientId', clientFilter);
    return params.toString();
  }, [clientFilter, deferredSearch, roleFilter, statusFilter]);

  const { data, isLoading, error } = useQuery<UserRow[]>({
    queryKey: ['users', query],
    queryFn: () => api.get(`/users${query ? `?${query}` : ''}`),
  });
  const { data: clients = [] } = useQuery<ClientOption[]>({ queryKey: ['clients'], queryFn: () => api.get('/clients') });

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/users', body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
      setFeedback({ tone: 'success', text: 'Cuenta creada y disponible para iniciar sesión.' });
    },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.patch(`/users/${id}`, body),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setAccessTarget(null);
      if (editing?.id === variables.id) closeModal();
      setFeedback({ tone: 'success', text: 'Acceso actualizado correctamente.' });
    },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const resetMutation = useMutation<ResetResult, Error>({
    mutationFn: () => api.post(`/users/${resetTarget?.id}/reset-password`, { sendEmail: sendResetEmail }),
    onSuccess: async (result) => {
      setResetResult(result);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setFeedback({ tone: 'success', text: result.emailSent ? 'Clave temporal generada y enviada por correo.' : 'Clave temporal generada. Compártela por un canal seguro.' });
    },
    onError: (mutationError) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const users = Array.isArray(data) ? data : [];
  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients]);
  const availableRoles = currentUser?.role === 'operations_director'
    ? USER_ROLES.filter((role) => !['admin', 'operations_director'].includes(role))
    : [...USER_ROLES];

  const canManage = (row: UserRow) => currentUser?.role === 'admin' || !['admin', 'operations_director'].includes(row.role);

  const openCreateModal = () => {
    setFeedback(null);
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (row: UserRow) => {
    setFeedback(null);
    setEditing(row);
    setForm({ name: row.name, email: row.email, password: '', phone: row.phone ?? '', role: row.role, clientId: row.clientId ?? '', workMode: row.workMode ?? 'hybrid', weeklyCapacityUd: Number(row.weeklyCapacityUd ?? 20) });
    setModalOpen(true);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    const body: Record<string, unknown> = {
      name: form.name.trim().replace(/\s+/g, ' '),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || undefined,
      role: form.role,
      clientId: form.role === 'client' ? form.clientId : null,
      workMode: form.role === 'client' ? undefined : form.workMode,
      weeklyCapacityUd: form.role === 'client' ? undefined : form.weeklyCapacityUd,
    };
    if (form.password) body.password = form.password;
    if (editing) updateMutation.mutate({ id: editing.id, body });
    else createMutation.mutate(body);
  };

  const generatePassword = () => {
    const values = new Uint32Array(4);
    window.crypto.getRandomValues(values);
    const generated = Array.from(values, (value) => value.toString(36)).join('-').slice(0, 24);
    setForm((current) => ({ ...current, password: `Vh-${generated}` }));
  };

  const openReset = (row: UserRow) => {
    setResetTarget(row);
    setResetResult(null);
    setSendResetEmail(true);
    resetMutation.reset();
    setFeedback(null);
  };

  const toggleAccess = (row: UserRow) => {
    setFeedback(null);
    if (row.isActive) { setAccessTarget(row); return; }
    updateMutation.mutate({ id: row.id, body: { isActive: !row.isActive } });
  };

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('');
    setStatusFilter('');
    setClientFilter('');
  };

  const bulkAccess = (rows: UserRow[], isActive: boolean) => {
    const manageable = rows.filter((row) => canManage(row) && row.id !== currentUser?.id);
    if (!manageable.length) return;
    setPendingBulkAccess({ rows: manageable, isActive });
  };

  const confirmBulkAccess = async () => {
    if (!pendingBulkAccess) return;
    const { rows: manageable, isActive } = pendingBulkAccess;
    setBulkAccessPending(true);
    try {
      await Promise.all(manageable.map((row) => api.patch(`/users/${row.id}`, { isActive })));
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setFeedback({ tone: 'success', text: `${manageable.length} acceso(s) actualizados.` });
    } catch (bulkError) {
      setFeedback({ tone: 'error', text: bulkError instanceof Error ? bulkError.message : 'No se pudo completar la acción masiva.' });
    } finally {
      setBulkAccessPending(false);
      setPendingBulkAccess(null);
    }
  };

  if (isLoading) return <LoadingSpinner text="Cargando usuarios..." />;
  if (error) return <div className="alert alert-error">Error al cargar usuarios: {error.message}</div>;

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const clientRequired = form.role === 'client';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">SEGURIDAD Y ALCANCE</span>
          <h1>Usuarios y accesos</h1>
          <p className="page-subtitle">Crea cuentas, asigna responsabilidades y limita el portal de clientes a una sola empresa.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>+ Crear cuenta</button>
      </div>

      {feedback && <div className={`alert alert-${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.text}</div>}

      <div className="filters users-filter-bar">
        <input className="input" aria-label="Buscar usuarios" placeholder="Nombre, email, teléfono o rol..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="input" aria-label="Filtrar por rol" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
          <option value="">Todos los roles</option>
          {USER_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
        </select>
        <select className="input" aria-label="Filtrar por acceso" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">Activos e inactivos</option><option value="true">Solo activos</option><option value="false">Solo inactivos</option>
        </select>
        <select className="input" aria-label="Filtrar por empresa" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
          <option value="">Todas las empresas</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        <button type="button" className="btn btn-outline btn-sm" onClick={clearFilters} disabled={!search && !roleFilter && !statusFilter && !clientFilter}>Limpiar</button>
        <span className="filter-result-count">{users.length} resultado{users.length === 1 ? '' : 's'}</span>
      </div>

      <DataTable<UserRow>
        storageKey="users"
        exportFileName="usuarios"
        selectable
        bulkActions={[{ label: 'Activar accesos', onClick: (rows) => bulkAccess(rows, true) }, { label: 'Desactivar accesos', tone: 'danger', onClick: (rows) => bulkAccess(rows, false) }]}
        keyExtractor={(row) => row.id}
        columns={[
          { key: 'name', label: 'Persona', sortable: true, render: (row) => <div className="user-cell"><strong>{row.name}</strong><small>{row.email}</small></div> },
          { key: 'role', label: 'Rol', sortable: true, sortValue: (row) => ROLE_LABELS[row.role], render: (row) => <span className="access-role">{ROLE_LABELS[row.role] ?? row.role}</span> },
          { key: 'clientId', label: 'Alcance', render: (row) => <span className="access-scope"><strong>{row.clientId ? clientMap.get(row.clientId) ?? 'Empresa no disponible' : 'Equipo interno'}</strong><small>{row.role === 'client' ? 'Portal de cliente' : WORK_MODE_LABELS[row.workMode || 'hybrid']}</small></span> },
          { key: 'phone', label: 'Teléfono', render: (row) => row.phone || '-' },
          { key: 'isActive', label: 'Acceso', render: (row) => <div className="access-state-cell"><button type="button" className={`access-toggle ${row.isActive ? 'active' : ''}`} onClick={() => toggleAccess(row)} disabled={updateMutation.isPending || row.id === currentUser?.id || !canManage(row)} aria-label={`${row.isActive ? 'Desactivar' : 'Activar'} a ${row.name}`}><i aria-hidden="true" /><span>{row.isActive ? 'Activo' : 'Inactivo'}</span></button>{row.mustChangePassword && <small>Clave temporal</small>}</div> },
          { key: 'createdAt', label: 'Creado', sortable: true, render: (row) => new Date(row.createdAt).toLocaleDateString('es-CL') },
          { key: 'id', label: 'Acciones', render: (row) => <div className="table-actions"><button type="button" className="btn btn-outline btn-sm" onClick={() => openEditModal(row)} disabled={!canManage(row)}>Editar</button><button type="button" className="btn btn-outline btn-sm" onClick={() => openReset(row)} disabled={!canManage(row) || row.id === currentUser?.id}>Resetear clave</button></div> },
        ]}
        data={users}
        emptyMessage="No hay usuarios para los filtros seleccionados"
      />

      <Modal open={modalOpen} onClose={closeModal} title={editing ? `Editar a ${editing.name}` : 'Crear cuenta'}>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="account-form-intro"><strong>{editing ? 'Datos y permisos' : 'Nueva identidad de acceso'}</strong><p>El rol define los módulos visibles. Una cuenta cliente siempre debe quedar vinculada a una empresa.</p></div>
          {feedback?.tone === 'error' && <div className="alert alert-error" role="alert">{feedback.text}</div>}
          <label htmlFor="user-name">Nombre completo<input id="user-name" className="input" autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength={2} maxLength={255} required /></label>
          <div className="form-row">
            <label htmlFor="user-email">Email<input id="user-email" className="input" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
            <label htmlFor="user-phone">Teléfono<input id="user-phone" className="input" type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          </div>
          <div className="form-row">
            <label htmlFor="user-role">Rol<select id="user-role" className="input" value={form.role} disabled={editing?.id === currentUser?.id} onChange={(event) => setForm({ ...form, role: event.target.value, clientId: event.target.value === 'client' ? form.clientId : '' })}>
              {availableRoles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
              {!availableRoles.includes(form.role as (typeof USER_ROLES)[number]) && <option value={form.role}>{ROLE_LABELS[form.role] ?? form.role}</option>}
            </select></label>
            <label htmlFor="user-client">Empresa<select id="user-client" className="input" value={form.clientId} disabled={!clientRequired} required={clientRequired} onChange={(event) => setForm({ ...form, clientId: event.target.value })}>
              <option value="">Selecciona una empresa</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select></label>
          </div>
          {form.role !== 'client' && <div className="form-row"><label htmlFor="user-work-mode">Modalidad laboral<select id="user-work-mode" className="input" value={form.workMode} onChange={(event) => setForm({ ...form, workMode: event.target.value })}><option value="presential">Presencial</option><option value="hybrid">Híbrida</option><option value="remote">Remota</option></select></label><label htmlFor="user-capacity">Capacidad semanal UD<input id="user-capacity" className="input" type="number" min={1} max={1000} value={form.weeklyCapacityUd} onChange={(event) => setForm({ ...form, weeklyCapacityUd: Number(event.target.value) })} /></label></div>}
          <label htmlFor="user-password">{editing ? 'Nueva contraseña temporal (opcional)' : 'Contraseña temporal'}<div className="password-generator"><input id="user-password" className="input" type="text" autoComplete="new-password" minLength={8} maxLength={128} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editing} /><button type="button" className="btn btn-outline btn-sm" onClick={generatePassword}>Generar segura</button></div><small>Se solicitará una clave personal en el primer ingreso.</small></label>
          <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={closeModal}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={isSaving || (clientRequired && !form.clientId)}>{isSaving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear usuario'}</button></div>
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(accessTarget)}
        title="Desactivar acceso"
        description={`${accessTarget?.name ?? ''} ya no podrá iniciar sesión, pero su historial y asignaciones se conservarán.`}
        confirmLabel="Confirmar desactivación"
        pending={updateMutation.isPending}
        error={updateMutation.error?.message}
        onClose={() => setAccessTarget(null)}
        onConfirm={() => accessTarget && updateMutation.mutate({ id: accessTarget.id, body: { isActive: false } })}
      />
      <ConfirmDialog
        open={pendingBulkAccess !== null}
        title={pendingBulkAccess?.isActive ? 'Activar accesos' : 'Desactivar accesos'}
        description={pendingBulkAccess ? `${pendingBulkAccess.isActive ? 'Se activará el acceso de' : 'Se desactivará el acceso de'} ${pendingBulkAccess.rows.length} cuenta(s).` : ''}
        confirmLabel={pendingBulkAccess?.isActive ? 'Activar' : 'Desactivar'}
        pending={bulkAccessPending}
        onClose={() => setPendingBulkAccess(null)}
        onConfirm={() => void confirmBulkAccess()}
      />
      <Modal open={Boolean(resetTarget)} onClose={() => { setResetTarget(null); setResetResult(null); }} title={`Resetear clave de ${resetTarget?.name ?? ''}`}>
        <div className="modal-form reset-access-modal">
          {!resetResult ? <><p>Se cerrarán las sesiones activas y se generará una contraseña temporal. La persona deberá cambiarla al ingresar.</p><label className="toggle-row"><input type="checkbox" checked={sendResetEmail} onChange={(event) => setSendResetEmail(event.target.checked)} /> Enviar también al correo {resetTarget?.email}</label>{resetMutation.error && <div className="alert alert-error">{resetMutation.error.message}</div>}<div className="modal-actions"><button className="btn btn-outline" type="button" onClick={() => setResetTarget(null)}>Cancelar</button><button className="btn btn-primary" type="button" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>{resetMutation.isPending ? 'Generando...' : 'Generar acceso temporal'}</button></div></> : <><div className="temporary-password-result"><span>CLAVE TEMPORAL · SE MUESTRA UNA VEZ</span><strong>{resetResult.temporaryPassword}</strong><button className="btn btn-outline btn-sm" type="button" onClick={() => navigator.clipboard.writeText(resetResult.temporaryPassword)}>Copiar clave</button></div><div className={`alert alert-${resetResult.emailSent ? 'success' : 'info'}`}>{resetResult.emailSent ? 'También fue enviada por correo.' : 'El correo no fue enviado. Comparte esta clave por un canal seguro.'}</div><button className="btn btn-primary btn-block" type="button" onClick={() => { setResetTarget(null); setResetResult(null); }}>Cerrar</button></>}
        </div>
      </Modal>
    </div>
  );
}
