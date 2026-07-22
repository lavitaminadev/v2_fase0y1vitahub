import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { DataTable } from '../../shared/DataTable';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { StatusBadge } from '../../shared/StatusBadge';
import { Modal } from '../../shared/Modal';
import { matchesSearch } from '../../shared/search';
import { useAuth } from '../../core/auth';
import { useSearchParams } from 'react-router-dom';

interface DocumentRecord {
  [key: string]: unknown;
  id: string;
  clientId?: string;
  name: string;
  type: string;
  fileUrl?: string;
  driveFileId?: string;
  version: number;
  status: string;
  tags?: string[];
  createdAt: string;
}

interface ClientOption {
  id: string;
  name: string;
  driveFolderId?: string;
}

interface DriveResult { rootId: string; rootUrl: string; folders: Record<string, string> }
interface UploadResult { id: string; originalName: string; driveFileId?: string }

interface DocumentFormState {
  clientId: string;
  name: string;
  type: string;
  fileUrl: string;
  driveFileId: string;
  status: string;
  tags: string;
}

const emptyForm: DocumentFormState = {
  clientId: '',
  name: '',
  type: 'other',
  fileUrl: '',
  driveFileId: '',
  status: 'draft',
  tags: '',
};

export function DocumentsPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(searchParams.get('create') === '1');
  const [editing, setEditing] = useState<DocumentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRecord | null>(null);
  const [form, setForm] = useState<DocumentFormState>(emptyForm);
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [clientFilter, setClientFilter] = useState(searchParams.get('clientId') ?? '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);
  const [driveOpen, setDriveOpen] = useState(false);
  const [driveClientId, setDriveClientId] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const user = useAuth((state) => state.user);
  const canManage = ['admin', 'operations_director'].includes(user?.role ?? '');
  const canDelete = user?.role === 'admin';

  const { data, isLoading, error } = useQuery({
    queryKey: ['documents'],
    queryFn: () => api.get<{ data: DocumentRecord[] }>('/documents'),
  });

  const { data: clients } = useQuery<ClientOption[]>({
    queryKey: ['clients'],
    queryFn: () => api.get<ClientOption[]>('/clients'),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/documents', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      closeModal();
      setFeedback({ tone: 'success', text: 'Documento creado correctamente.' });
    },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.put(`/documents/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      closeModal();
      setFeedback({ tone: 'success', text: 'Documento actualizado correctamente.' });
    },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['documents'] }); setDeleteTarget(null); setFeedback({ tone: 'success', text: 'Documento eliminado.' }); },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const driveMutation = useMutation<DriveResult, Error, string>({
    mutationFn: (clientId) => api.post(`/documents/drive/clients/${clientId}/bootstrap`),
    onSuccess: async () => {
      setFeedback({ tone: 'success', text: 'La estructura estándar de Drive quedó preparada.' });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['clients'] }), queryClient.invalidateQueries({ queryKey: ['client-overview'] })]);
    },
    onError: (mutationError) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!form.clientId) throw new Error('Selecciona el cliente antes de subir el archivo.');
      const drive = await api.post<DriveResult>(`/documents/drive/clients/${form.clientId}/bootstrap`);
      const upload = await api.upload<UploadResult>('/uploads', file);
      try {
        const synced = await api.post<UploadResult>(`/uploads/${upload.id}/drive`, { folderId: drive.rootId });
        return { upload: synced, drive };
      } catch (error) {
        await api.delete(`/uploads/${upload.id}`).catch(() => undefined);
        throw error;
      }
    },
    onSuccess: ({ upload }) => {
      setPendingUploadId(upload.id);
      setForm((current) => ({
        ...current,
        name: current.name || upload.originalName,
        driveFileId: upload.driveFileId || '',
        fileUrl: upload.driveFileId ? `https://drive.google.com/file/d/${upload.driveFileId}/view` : current.fileUrl,
      }));
      setSelectedFile(null);
      setFeedback({ tone: 'success', text: 'Archivo subido a la carpeta del cliente. Completa los datos y guarda el documento.' });
    },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const docs = useMemo(() => {
    const source = data?.data ?? [];
    return source.filter((doc) => (!clientFilter || doc.clientId === clientFilter) && matchesSearch(search, [doc.name, doc.type, doc.status, doc.fileUrl, ...(doc.tags ?? [])]));
  }, [clientFilter, data, search]);

  const clientMap = useMemo(
    () => new Map((clients ?? []).map((client) => [client.id, client.name])),
    [clients],
  );

  const openCreate = () => {
    setFeedback(null);
    setEditing(null);
    setForm({ ...emptyForm, clientId: clientFilter });
    setSelectedFile(null);
    setPendingUploadId(null);
    setIsCreateOpen(true);
  };

  const openEdit = (doc: DocumentRecord) => {
    setFeedback(null);
    setEditing(doc);
    setSelectedFile(null);
    setPendingUploadId(null);
    setForm({
      clientId: doc.clientId ?? '',
      name: doc.name,
      type: doc.type,
      fileUrl: doc.fileUrl ?? '',
      driveFileId: doc.driveFileId ?? '',
      status: doc.status,
      tags: (doc.tags ?? []).join(', '),
    });
    setIsCreateOpen(true);
  };

  const closeModal = () => {
    if (pendingUploadId) void api.delete(`/uploads/${pendingUploadId}`).catch(() => undefined);
    setEditing(null);
    setForm(emptyForm);
    setSelectedFile(null);
    setPendingUploadId(null);
    setIsCreateOpen(false);
  };

  const submitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      clientId: form.clientId,
      name: form.name.trim(),
      type: form.type.trim(),
      fileUrl: form.fileUrl.trim() || undefined,
      driveFileId: form.driveFileId.trim() || undefined,
      status: form.status.trim() || undefined,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
      return;
    }

    createMutation.mutate(payload);
  };

  const bulkDocumentStatus = async (rows: DocumentRecord[], status: 'draft' | 'approved') => {
    if (!canManage || !window.confirm(`Cambiar ${rows.length} documento(s) a estado ${status}?`)) return;
    try {
      await Promise.all(rows.map((row) => api.put(`/documents/${row.id}`, { status })));
      await queryClient.invalidateQueries({ queryKey: ['documents'] });
      setFeedback({ tone: 'success', text: `${rows.length} documento(s) actualizados.` });
    } catch (bulkError) {
      setFeedback({ tone: 'error', text: bulkError instanceof Error ? bulkError.message : 'No se pudo completar la acción masiva.' });
    }
  };

  if (isLoading) return <LoadingSpinner text="Cargando documentos..." />;
  if (error) return <div className="alert alert-error">Error al cargar documentos</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Documentos</h1>
          <p className="page-subtitle">Repositorio operativo con alta, edición y trazabilidad básica por cliente.</p>
        </div>
        {canManage && <div className="page-header-actions"><button className="btn btn-outline" onClick={() => { setDriveClientId(clientFilter); setDriveOpen(true); setFeedback(null); }}>Preparar Drive</button><button className="btn btn-primary" onClick={openCreate}>Nuevo documento</button></div>}
      </div>

      <div className="filters">
        <input
          className="input"
          placeholder="Buscar por nombre, tipo, estado o tags"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className="input" aria-label="Filtrar documentos por cliente" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}><option value="">Todos los clientes</option>{(clients ?? []).map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select>
      </div>
      {feedback && <div className={`alert alert-${feedback.tone}`} role="alert">{feedback.text}</div>}

      <DataTable<DocumentRecord>
        storageKey="documents"
        exportFileName="documentos"
        selectable={canManage}
        bulkActions={canManage ? [{ label: 'Marcar borrador', onClick: (rows) => bulkDocumentStatus(rows, 'draft') }, { label: 'Marcar aprobado', onClick: (rows) => bulkDocumentStatus(rows, 'approved') }] : []}
        keyExtractor={(row) => row.id}
        columns={[
          { key: 'name', label: 'Nombre', sortable: true },
          {
            key: 'clientId',
            label: 'Cliente',
            render: (row) => clientMap.get(row.clientId ?? '') ?? 'Sin cliente',
          },
          { key: 'type', label: 'Tipo', sortable: true },
          { key: 'version', label: 'Versión', sortable: true },
          { key: 'status', label: 'Estado', render: (row) => <StatusBadge status={row.status} /> },
          {
            key: 'fileUrl',
            label: 'Archivo',
            render: (row) =>
              row.fileUrl ? (
                <a href={row.fileUrl} target="_blank" rel="noreferrer">
                  Abrir
                </a>
              ) : (
                'Pendiente'
              ),
          },
          {
            key: 'createdAt',
            label: 'Creado',
            sortable: true,
            render: (row) => new Date(row.createdAt).toLocaleDateString(),
          },
          {
            key: 'id',
            label: 'Acciones',
            render: (row) => (
              <div className="actions-cell">
                {canManage && <button className="btn btn-sm btn-outline" onClick={() => openEdit(row)}>Editar</button>}
                {canDelete && <button
                  className="btn btn-sm btn-outline btn-danger"
                  onClick={() => setDeleteTarget(row)}
                  disabled={deleteMutation.isPending}
                >Eliminar</button>}
              </div>
            ),
          },
        ]}
        data={docs}
        emptyMessage="No hay documentos cargados todavía."
      />

      <Modal
        open={isCreateOpen}
        onClose={closeModal}
        title={editing ? 'Editar documento' : 'Nuevo documento'}
      >
        <form onSubmit={submitForm} className="document-form">
          <div className="form-group">
            <label htmlFor="document-client">Cliente</label>
            <select
              id="document-client"
              className="input"
              value={form.clientId}
              onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))}
              required
            >
              <option value="">Selecciona un cliente</option>
              {(clients ?? []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="document-name">Nombre</label>
            <input
              id="document-name"
              className="input"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="document-type">Tipo</label>
              <input
                id="document-type"
                className="input"
                value={form.type}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="document-status">Estado</label>
              <select
                id="document-status"
                className="input"
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="draft">Borrador</option>
                <option value="review">En revisión</option>
                <option value="approved">Aprobado</option>
                <option value="archived">Archivado</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="document-url">URL del archivo</label>
            <input
              id="document-url"
              className="input"
              type="url"
              value={form.fileUrl}
              onChange={(event) => setForm((current) => ({ ...current, fileUrl: event.target.value }))}
            />
          </div>

          <div className="document-upload-box">
            <div><strong>Subir desde este equipo</strong><span>VITAHUB prepara la carpeta del cliente y envía el archivo a Google Drive. Máximo 20 MB.</span></div>
            <input id="document-upload" type="file" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
            <label className="btn btn-outline" htmlFor="document-upload">{selectedFile ? 'Cambiar archivo' : 'Seleccionar archivo'}</label>
            {selectedFile && <div className="document-file-choice"><span><strong>{selectedFile.name}</strong><small>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</small></span><button type="button" className="btn btn-primary btn-sm" onClick={() => uploadMutation.mutate(selectedFile)} disabled={uploadMutation.isPending}>{uploadMutation.isPending ? 'Subiendo...' : 'Subir a Drive'}</button></div>}
            {uploadMutation.error && <div className="alert alert-error">{uploadMutation.error.message}</div>}
            {form.driveFileId && <div className="alert alert-success">Archivo vinculado con Google Drive.</div>}
          </div>

          <div className="form-group">
            <label htmlFor="document-drive">ID del archivo en Drive <small>(opcional si ingresaste una URL)</small></label>
            <input
              id="document-drive"
              className="input"
              value={form.driveFileId}
              onChange={(event) => setForm((current) => ({ ...current, driveFileId: event.target.value }))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="document-tags">Tags</label>
            <input
              id="document-tags"
              className="input"
              placeholder="brief, contrato, aprobado"
              value={form.tags}
              onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Guardando...'
                : editing
                  ? 'Guardar cambios'
                  : 'Crear documento'}
            </button>
          </div>
        </form>
      </Modal>
      <Modal open={driveOpen} onClose={() => { setDriveOpen(false); setDriveClientId(''); driveMutation.reset(); }} title="Preparar Google Drive">
        <div className="modal-form drive-bootstrap-modal">
          <p>Se creará la carpeta principal del cliente y cinco subcarpetas estándar para brief, editables, revisión, aprobados y entregables finales. Si ya existen, se reutilizarán.</p>
          <label>Cliente<select className="input" value={driveClientId} onChange={(event) => { setDriveClientId(event.target.value); driveMutation.reset(); }}><option value="">Selecciona un cliente</option>{(clients ?? []).map((client) => <option value={client.id} key={client.id}>{client.name}{client.driveFolderId ? ' · Drive preparado' : ''}</option>)}</select></label>
          {driveMutation.error && <div className="alert alert-error">{driveMutation.error.message}</div>}
          {driveMutation.data && <div className="drive-bootstrap-result"><span>✓</span><div><strong>Estructura lista</strong><small>{Object.keys(driveMutation.data.folders).length} carpetas operativas verificadas.</small></div><a className="btn btn-outline btn-sm" href={driveMutation.data.rootUrl} target="_blank" rel="noreferrer">Abrir Drive</a></div>}
          <div className="modal-actions"><button className="btn btn-outline" type="button" onClick={() => setDriveOpen(false)}>Cerrar</button><button className="btn btn-primary" type="button" disabled={!driveClientId || driveMutation.isPending} onClick={() => driveMutation.mutate(driveClientId)}>{driveMutation.isPending ? 'Preparando...' : 'Crear o verificar carpetas'}</button></div>
        </div>
      </Modal>
      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Eliminar documento">
        <div className="modal-form">
          <p>Se eliminará “{deleteTarget?.name}” del registro. El archivo externo de Drive no será borrado.</p>
          {deleteMutation.error && <div className="alert alert-error">{deleteMutation.error.message}</div>}
          <div className="modal-actions"><button className="btn btn-outline" type="button" onClick={() => setDeleteTarget(null)}>Cancelar</button><button className="btn btn-danger" type="button" disabled={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>{deleteMutation.isPending ? 'Eliminando...' : 'Confirmar eliminación'}</button></div>
        </div>
      </Modal>
    </div>
  );
}
