import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import type { ReservationForm } from '../reservations/types';

interface ClientOption { id: string; name: string }

interface MetaPixelCatalog {
  bindings: Array<{ clientId: string; clientName: string; pixelId: string | null; pixelName: string | null; tokenConfigured: boolean; configuredAt: string | null }>;
  pixels: Array<{ pixelId: string; clientNames: string[]; pixelNames: string[]; usageCount: number; tokenConfigured: boolean }>;
}

export function MeasurementCenter() {
  const { data: clientsResp } = useQuery<{ data: ClientOption[] }>({ queryKey: ['clients'], queryFn: () => api.get('/clients') });
  const clients = Array.isArray((clientsResp as any)?.data) ? (clientsResp as any).data : [];
  const clientName = (id: string) => clients.find((client) => client.id === id)?.name || 'Empresa no disponible';

  const { data: forms = [] } = useQuery<ReservationForm[]>({ queryKey: ['reservation-forms', 'measurement-center'], queryFn: () => api.get('/reservations/forms') });
  const { data: metaCatalog } = useQuery<MetaPixelCatalog>({ queryKey: ['meta-client-pixel-catalog'], queryFn: () => api.get('/integrations/meta/client-pixels/catalog') });

  const pixelUsage = useMemo(() => {
    const byClient = new Map((metaCatalog?.bindings ?? []).filter((binding) => binding.pixelId).map((binding) => [binding.clientId, binding]));
    const usage = new Map<string, Array<ReservationForm>>();
    for (const form of forms) {
      const binding = byClient.get(form.clientId);
      if (!binding?.pixelId || !form.metaCapiEnabled) continue;
      usage.set(binding.pixelId, [...(usage.get(binding.pixelId) ?? []), form]);
    }
    return usage;
  }, [forms, metaCatalog?.bindings]);

  const ga4Rows = useMemo(() => {
    const rows = new Map<string, { measurementId: string; clients: Set<string>; forms: ReservationForm[] }>();
    for (const form of forms) {
      if (!form.ga4MeasurementId) continue;
      const current = rows.get(form.ga4MeasurementId) ?? { measurementId: form.ga4MeasurementId, clients: new Set<string>(), forms: [] };
      current.clients.add(form.clientId);
      current.forms.push(form);
      rows.set(form.ga4MeasurementId, current);
    }
    return Array.from(rows.values()).sort((a, b) => b.forms.length - a.forms.length);
  }, [forms]);

  const configuredPixels = metaCatalog?.pixels ?? [];
  const formsWithMeta = Array.from(pixelUsage.values()).reduce((total, list) => total + list.length, 0);
  const formsWithGa4 = forms.filter((form) => form.ga4MeasurementId).length;

  return (
    <section className="integration-card measurement-center">
      <div className="integration-header">
        <span className="integration-icon">M</span>
        <div className="integration-info">
          <div className="integration-name">Centro de medicion</div>
          <div className="integration-provider">Meta Pixel + CAPI, Google Analytics 4 y uso por empresa/flujo</div>
        </div>
      </div>

      <div className="meta-health-strip">
        <div className="meta-health-item"><strong>{configuredPixels.length}</strong><span>Pixels Meta</span></div>
        <div className="meta-health-item"><strong>{formsWithMeta}</strong><span>flujos con CAPI</span></div>
        <div className="meta-health-item"><strong>{ga4Rows.length}</strong><span>IDs GA4</span></div>
        <div className="meta-health-item"><strong>{formsWithGa4}</strong><span>flujos con GA4</span></div>
      </div>

      <div className="measurement-grid">
        <section>
          <div className="integration-section-head">
            <div><h4>Meta Pixel + CAPI</h4><p className="page-subtitle">Que Pixel esta guardado, cuantas empresas lo usan y cuantos flujos envian eventos.</p></div>
          </div>
          <div className="measurement-list">
            {configuredPixels.length === 0 ? <div className="alert alert-warning">Aun no hay Pixels guardados.</div> : configuredPixels.map((pixel) => {
              const formsUsingPixel = pixelUsage.get(pixel.pixelId) ?? [];
              return <article key={pixel.pixelId} className="measurement-row">
                <div><strong>{pixel.pixelNames[0] || 'Pixel Meta'}</strong><span>{pixel.pixelId}</span></div>
                <div><b>{pixel.usageCount}</b><small>empresa(s)</small></div>
                <div><b>{formsUsingPixel.length}</b><small>flujo(s)</small></div>
                <span className={`meta-readiness is-${pixel.tokenConfigured ? 'ok' : 'warn'}`}>{pixel.tokenConfigured ? 'Token CAPI listo' : 'Falta token'}</span>
                <small>{pixel.clientNames.join(', ') || 'Sin empresas asociadas'}</small>
                {formsUsingPixel.length > 0 && <small>Flujos: {formsUsingPixel.slice(0, 4).map((form) => `${form.name} (${clientName(form.clientId)})`).join(', ')}{formsUsingPixel.length > 4 ? '...' : ''}</small>}
              </article>;
            })}
          </div>
        </section>

        <section>
          <div className="integration-section-head">
            <div><h4>Google Analytics 4</h4><p className="page-subtitle">IDs de medicion reutilizados desde los flujos publicados o borradores.</p></div>
          </div>
          <div className="measurement-list">
            {ga4Rows.length === 0 ? <div className="alert alert-warning">Aun no hay IDs GA4 guardados en flujos.</div> : ga4Rows.map((row) => <article key={row.measurementId} className="measurement-row">
              <div><strong>GA4</strong><span>{row.measurementId}</span></div>
              <div><b>{row.clients.size}</b><small>empresa(s)</small></div>
              <div><b>{row.forms.length}</b><small>flujo(s)</small></div>
              <span className="meta-readiness is-ok">Disponible</span>
              <small>{Array.from(row.clients).map(clientName).join(', ')}</small>
              <small>Flujos: {row.forms.slice(0, 4).map((form) => form.name).join(', ')}{row.forms.length > 4 ? '...' : ''}</small>
            </article>)}
          </div>
        </section>
      </div>
    </section>
  );
}
