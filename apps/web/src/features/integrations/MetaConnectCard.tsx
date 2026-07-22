import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';

interface MetaConnectCardProps {
  integration?: {
    id: string;
    status: string;
    health?: string;
  };
}

interface ClientOption {
  id: string;
  name: string;
}

interface MetaPixelCatalog {
  bindings: Array<{
    clientId: string;
    clientName: string;
    pixelId: string | null;
    pixelName: string | null;
    tokenConfigured: boolean;
    configuredAt: string | null;
  }>;
  pixels: Array<{
    pixelId: string;
    clientNames: string[];
    pixelNames: string[];
    usageCount: number;
    tokenConfigured: boolean;
  }>;
}

type PixelMode = 'manual' | 'existing' | 'none';

const EMPTY_FORM = {
  clientId: '',
  mode: 'manual' as PixelMode,
  pixelId: '',
  pixelName: '',
  accessToken: '',
  existingPixelId: '',
};

export function MetaConnectCard({ integration }: MetaConnectCardProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const { data: clients = [] } = useQuery<ClientOption[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
  });

  const catalogQuery = useQuery<MetaPixelCatalog>({
    queryKey: ['meta-client-pixel-catalog'],
    queryFn: () => api.get('/integrations/meta/client-pixels/catalog'),
  });

  const selectedClientBinding = useMemo(
    () => catalogQuery.data?.bindings.find((binding) => binding.clientId === form.clientId),
    [catalogQuery.data?.bindings, form.clientId],
  );

  const saveMutation = useMutation({
    mutationFn: () => api.post('/integrations/meta/client-pixels/setup', {
      clientId: form.clientId,
      mode: form.mode,
      pixelId: form.mode === 'manual' ? form.pixelId.trim() : undefined,
      pixelName: form.pixelName.trim() || undefined,
      accessToken: form.mode === 'manual' ? form.accessToken.trim() || undefined : undefined,
      existingPixelId: form.mode === 'existing' ? form.existingPixelId : undefined,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['meta-client-pixel-catalog'] });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      setFeedback({
        tone: 'success',
        text: form.mode === 'none'
          ? 'La empresa quedó sin Pixel para Fase 1.'
          : 'Pixel y token CAPI guardados para las conversiones de esta empresa.',
      });
      setForm(EMPTY_FORM);
    },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });

  const canSubmit = Boolean(form.clientId)
    && (form.mode === 'none'
      || (form.mode === 'existing' && Boolean(form.existingPixelId))
      || (form.mode === 'manual' && Boolean(form.pixelId.trim()) && Boolean(form.pixelName.trim())));

  const configuredCount = catalogQuery.data?.bindings.filter((binding) => binding.pixelId).length ?? 0;
  const alertCount = catalogQuery.data?.bindings.filter((binding) => binding.pixelId && !binding.tokenConfigured).length ?? 0;

  return (
    <div className="integration-card meta-card">
      <div className="integration-header">
        <span className="integration-icon">M</span>
        <div className="integration-info">
          <div className="integration-name">Meta Pixel + CAPI por empresa</div>
          <div className="integration-provider">Pixel ID + token CAPI, sin OAuth ni App Review para Fase 1</div>
        </div>
      </div>

      <div className="meta-health-strip">
        <div className="meta-health-item">
          <strong>{configuredCount}</strong>
          <span>empresas con Pixel</span>
        </div>
        <div className="meta-health-item">
          <strong>{catalogQuery.data?.pixels.length ?? 0}</strong>
          <span>Pixels registrados</span>
        </div>
        <div className="meta-health-item">
          <strong>{alertCount}</strong>
          <span>alertas por token</span>
        </div>
        <div className="meta-health-item">
          <strong>{integration?.status === 'active' ? 'Fase 2' : 'No requerido'}</strong>
          <span>OAuth Meta</span>
        </div>
      </div>

      <div className="alert alert-info">
        En esta fase Meta se configura pegando el Pixel ID y el token CAPI generado en Events Manager. OAuth queda reservado para leer métricas o activos en Fase 2.
      </div>

      {feedback && <div className={`alert alert-${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.text}</div>}
      {catalogQuery.error && <div className="alert alert-error">No pudimos cargar el catálogo de Pixels por empresa.</div>}

      <section className="integration-section">
        <div className="integration-section-head">
          <div>
            <h4>Asignar Pixel a empresa</h4>
            <p className="page-subtitle">Esta decisión define qué Pixel recibirá Schedule y Reserva_Asistida desde las reservas de esa empresa.</p>
          </div>
        </div>

        <div className="client-pixel-admin-form">
          <label>
            Empresa
            <select className="input" value={form.clientId} onChange={(event) => {
              const binding = catalogQuery.data?.bindings.find((item) => item.clientId === event.target.value);
              setForm({
                ...EMPTY_FORM,
                clientId: event.target.value,
                mode: binding?.pixelId ? 'existing' : 'manual',
                existingPixelId: binding?.pixelId || '',
                pixelName: binding?.pixelName || '',
              });
              setFeedback(null);
            }}>
              <option value="">Selecciona empresa</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>

          {form.clientId && selectedClientBinding && (
            <div className={`alert ${selectedClientBinding.pixelId ? 'alert-info' : 'alert-warning'}`}>
              {selectedClientBinding.pixelId
                ? `Configuración actual: ${selectedClientBinding.pixelName || 'Pixel'} · ${selectedClientBinding.pixelId}${selectedClientBinding.tokenConfigured ? ' · token CAPI disponible' : ' · sin token CAPI'}`
                : 'Esta empresa todavía no tiene Pixel asignado.'}
            </div>
          )}

          <div className="pixel-mode-grid">
            {([
              ['manual', 'Agregar Pixel', 'Pega Pixel ID, nombre visible y token CAPI.'],
              ['existing', 'Usar existente', 'Reutiliza un Pixel ya guardado en VitaHub.'],
              ['none', 'Sin Pixel', 'Permite operar reservas sin enviar conversiones a Meta.'],
            ] as const).map(([mode, label, description]) => (
              <button type="button" key={mode} className={form.mode === mode ? 'active' : ''} onClick={() => setForm((current) => ({ ...current, mode }))}>
                <strong>{label}</strong>
                <small>{description}</small>
              </button>
            ))}
          </div>

          {form.mode === 'manual' && (
            <div className="form-row">
              <label>Pixel ID<input className="input" inputMode="numeric" value={form.pixelId} onChange={(event) => setForm({ ...form, pixelId: event.target.value })} placeholder="123456789012345" /></label>
              <label>Nombre del Pixel<input className="input" value={form.pixelName} onChange={(event) => setForm({ ...form, pixelName: event.target.value })} placeholder="Pixel Restaurante Centro" /></label>
              <label>Token CAPI<input className="input" type="password" autoComplete="new-password" value={form.accessToken} onChange={(event) => setForm({ ...form, accessToken: event.target.value })} placeholder="EAAB..." /></label>
            </div>
          )}

          {form.mode === 'existing' && (
            <div className="form-row">
              <label>Pixel existente<select className="input" value={form.existingPixelId} onChange={(event) => setForm({ ...form, existingPixelId: event.target.value })}>
                <option value="">Selecciona Pixel</option>
                {catalogQuery.data?.pixels.map((pixel) => <option key={pixel.pixelId} value={pixel.pixelId}>{pixel.pixelNames[0] || 'Pixel'} · {pixel.pixelId}</option>)}
              </select></label>
              <label>Nombre para esta empresa<input className="input" value={form.pixelName} onChange={(event) => setForm({ ...form, pixelName: event.target.value })} placeholder="Nombre visible opcional" /></label>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => { setForm(EMPTY_FORM); setFeedback(null); }}>Limpiar</button>
            <button type="button" className="btn btn-primary" disabled={!canSubmit || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? 'Validando...' : form.mode === 'none' ? 'Guardar sin Pixel' : 'Validar y guardar Pixel'}
            </button>
          </div>
        </div>
      </section>

      <section className="integration-section">
        <div className="integration-section-head">
          <div>
            <h4>Estado por empresa</h4>
            <p className="page-subtitle">Resumen rápido para saber qué empresas pueden enviar conversiones reales a Meta.</p>
          </div>
        </div>
        <div className="client-pixel-list">
          {catalogQuery.data?.bindings.map((row) => (
            <div key={row.clientId}>
              <strong>{row.clientName}</strong>
              <span>{row.pixelId ? `${row.pixelName || 'Pixel'} · ${row.pixelId}` : 'Sin Pixel'}</span>
              <small>{row.pixelId ? row.tokenConfigured ? 'Listo para CAPI' : 'Alerta: falta token CAPI' : 'No envía conversiones'}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
