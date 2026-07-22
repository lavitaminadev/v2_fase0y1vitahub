import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../../core/api';
import { StatusBadge } from '../../../shared/StatusBadge';
import { Modal } from '../../../shared/Modal';
import { statusLabel } from '../../../shared/status-labels';

interface LeadDetail {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status: string;
  source?: string;
  sourceDetail?: string;
  notes?: string;
  campaignName?: string;
  qualityScore: number;
  fitStatus: 'qualified' | 'review' | 'discarded';
  discardReason?: string;
  consentCapturedAt?: string;
  retentionReviewAt?: string;
}

interface LeadInteraction {
  id: string;
  type: string;
  description?: string;
  date: string;
}

interface InteractionPage {
  data: LeadInteraction[];
  total: number;
}

const LEAD_STAGES = ['new', 'contacted', 'meeting_scheduled', 'quote_sent', 'negotiation', 'won', 'lost'];

interface LeadDetailDrawerProps {
  leadId: string | null;
  onClose: () => void;
}

export function LeadDetailDrawer({ leadId, onClose }: LeadDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [anonymizeOpen, setAnonymizeOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'call', description: '', date: '' });
  const [conversionMessage, setConversionMessage] = useState('');
  const [drawerFeedback, setDrawerFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const { data: lead, isLoading, error: leadError } = useQuery<LeadDetail>({
    queryKey: ['lead', leadId],
    queryFn: () => api.get(`/crm/leads/${leadId}`),
    enabled: Boolean(leadId),
  });

  const interactionsQuery = useQuery<InteractionPage>({
    queryKey: ['lead-interactions', leadId],
    queryFn: () => api.get(`/crm/interactions?leadId=${leadId}&limit=20`),
    enabled: Boolean(leadId),
  });

  useEffect(() => {
    setConversionMessage('');
    setDrawerFeedback(null);
    setActivityOpen(false);
    setActivityForm({ type: 'call', description: '', date: '' });
  }, [leadId]);

  useEffect(() => {
    if (!leadId) return undefined;
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [leadId, onClose]);

  const exportLeadMutation = useMutation({
    mutationFn: (id: string) => api.get<Record<string, unknown>>(`/data-protection/leads/${id}/export`),
    onSuccess: (data) => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `lead-${leadId}.json`;
      link.click();
      URL.revokeObjectURL(url);
    },
  });

  const anonymizeLeadMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/data-protection/leads/${id}/anonymize`),
    onSuccess: () => {
      setAnonymizeOpen(false);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onClose();
    },
  });

  const convertLeadMutation = useMutation({
    mutationFn: (id: string) => api.post<{ client: { id: string; name: string } }>(`/crm/leads/${id}/convert`),
    onSuccess: async (result) => {
      setConvertOpen(false);
      setConversionMessage(`${result.client.name} fue creado como cliente y ya puede iniciar onboarding.`);
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const stageMutation = useMutation({
    mutationFn: (status: string) => api.put(`/crm/leads/${leadId}`, { status }),
    onSuccess: async () => {
      setDrawerFeedback({ tone: 'success', text: 'Etapa comercial actualizada.' });
      await queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (mutationError: Error) => setDrawerFeedback({ tone: 'error', text: mutationError.message }),
  });

  const createActivityMutation = useMutation({
    mutationFn: () => api.post('/crm/interactions', {
      leadId,
      type: activityForm.type,
      description: activityForm.description.trim(),
      date: activityForm.date ? new Date(activityForm.date).toISOString() : undefined,
    }),
    onSuccess: async () => {
      setActivityOpen(false);
      setActivityForm({ type: 'call', description: '', date: '' });
      setDrawerFeedback({ tone: 'success', text: 'Actividad agregada al historial del lead.' });
      await queryClient.invalidateQueries({ queryKey: ['lead-interactions', leadId] });
      await queryClient.invalidateQueries({ queryKey: ['crm-interactions'] });
    },
    onError: (mutationError: Error) => setDrawerFeedback({ tone: 'error', text: mutationError.message }),
  });

  if (!leadId) return null;

  return (
    <>
      <button type="button" className={`drawer-backdrop ${leadId ? 'is-open' : ''}`} onClick={onClose} aria-label="Cerrar ficha del lead" />
      <aside className={`drawer-panel lead-detail-panel ${leadId ? 'is-open' : ''}`} role="dialog" aria-modal="true" aria-labelledby="lead-drawer-title">
        <div className="drawer-header">
          <div className="drawer-title-group">
            <span className="drawer-eyebrow">FICHA COMERCIAL</span>
            <h3 id="lead-drawer-title">{isLoading ? 'Cargando...' : lead?.name}</h3>
            {!isLoading && lead && (
              <div className="drawer-badges">
                <StatusBadge status={lead.status} />
                <StatusBadge status={lead.fitStatus} />
              </div>
            )}
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Cerrar ficha">&times;</button>
        </div>

        <div className="drawer-content">
          {isLoading ? (
            <div className="loading-container"><div className="spinner" /></div>
          ) : leadError ? (
            <div className="alert alert-error" role="alert">No fue posible cargar la ficha. Cierra este panel e intenta nuevamente.</div>
          ) : lead ? (
            <div className="drawer-sections">

              {drawerFeedback && <div className={`alert alert-${drawerFeedback.tone}`} role={drawerFeedback.tone === 'error' ? 'alert' : 'status'}>{drawerFeedback.text}</div>}

              <div className="drawer-command-strip">
                <label>
                  <span>Etapa actual</span>
                  <select className="input" value={lead.status} disabled={stageMutation.isPending || lead.status === 'won'} onChange={(event) => stageMutation.mutate(event.target.value)}>
                    {LEAD_STAGES.map((stage) => <option key={stage} value={stage} disabled={stage === 'won' && lead.status !== 'won'}>{stage === 'won' ? 'Ganado (convertir)' : statusLabel(stage)}</option>)}
                  </select>
                </label>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setActivityOpen(true)}>+ Registrar actividad</button>
              </div>

              <div className="drawer-section">
                <h4>Información Principal</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Empresa</span>
                    <span className="detail-value">{lead.company || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Email</span>
                    <span className="detail-value">{lead.email || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Teléfono</span>
                    <span className="detail-value">{lead.phone || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Origen</span>
                    <span className="detail-value">{lead.sourceDetail || lead.source || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="drawer-section">
                <h4>Métricas y Privacidad</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Score (Calidad)</span>
                    <span className="detail-value">
                      <span className={`lead-score ${lead.qualityScore >= 70 ? 'lead-score-good' : lead.qualityScore >= 35 ? 'lead-score-mid' : 'lead-score-bad'}`}>
                        {lead.qualityScore} / 100
                      </span>
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Campaña Meta</span>
                    <span className="detail-value">{lead.campaignName || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Consentimiento (Opt-in)</span>
                    <span className="detail-value">
                      {lead.consentCapturedAt ? new Date(lead.consentCapturedAt).toLocaleString() : 'No registrado'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Revisión Retención</span>
                    <span className="detail-value">
                      {lead.retentionReviewAt ? new Date(lead.retentionReviewAt).toLocaleDateString() : 'Sin fecha'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="drawer-section lead-activity-section">
                <div className="drawer-section-heading">
                  <div><h4>Actividad comercial</h4><p>{interactionsQuery.data?.total ?? 0} registro{interactionsQuery.data?.total === 1 ? '' : 's'} vinculado{interactionsQuery.data?.total === 1 ? '' : 's'}</p></div>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setActivityOpen(true)}>Agregar</button>
                </div>
                {interactionsQuery.isLoading ? (
                  <div className="drawer-inline-loading"><span className="spinner" /> Cargando historial...</div>
                ) : interactionsQuery.error ? (
                  <div className="alert alert-error">No fue posible cargar el historial comercial.</div>
                ) : interactionsQuery.data?.data.length ? (
                  <div className="lead-activity-timeline">
                    {interactionsQuery.data.data.map((interaction) => {
                      const upcoming = new Date(interaction.date).getTime() > Date.now();
                      return (
                        <article key={interaction.id} className={upcoming ? 'is-upcoming' : ''}>
                          <i aria-hidden="true" />
                          <div><span><strong>{statusLabel(interaction.type)}</strong>{upcoming && <b>Proxima</b>}</span><time>{new Date(interaction.date).toLocaleString('es-CL')}</time><p>{interaction.description || 'Sin observaciones adicionales.'}</p></div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="lead-activity-empty"><strong>Sin actividad registrada</strong><span>Agrega la primera llamada, reunion, correo o seguimiento.</span></div>
                )}
              </div>

              {lead.notes && (
                <div className="drawer-section">
                  <h4>Notas (Meta / Adicionales)</h4>
                  <div className="lead-note-full">{lead.notes}</div>
                </div>
              )}

              {lead.discardReason && (
                <div className="drawer-section">
                  <h4>Motivo de Descarte</h4>
                  <div className="lead-discard-reason">{lead.discardReason}</div>
                </div>
              )}

              <div className="drawer-section">
                <h4>Continuidad comercial</h4>
                {conversionMessage && <div className="alert alert-success">{conversionMessage}</div>}
                {lead.status !== 'won' ? <><p className="page-subtitle">Al confirmar el cierre se crea la ficha del cliente en onboarding y el lead queda vinculado para trazabilidad.</p><button className="btn btn-primary btn-sm" type="button" onClick={() => setConvertOpen(true)}>Convertir en cliente</button></> : <div className="alert alert-info">Este lead ya fue convertido o marcado como ganado.</div>}
              </div>

              <div className="drawer-section">
                <h4>Acciones de Privacidad</h4>
                <div className="drawer-actions">
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => exportLeadMutation.mutate(lead.id)}
                    disabled={exportLeadMutation.isPending}
                  >
                    {exportLeadMutation.isPending ? 'Exportando...' : 'Descargar Datos (Export)'}
                  </button>
                  <button
                    className="btn btn-outline btn-sm btn-danger"
                    onClick={() => setAnonymizeOpen(true)}
                    disabled={anonymizeLeadMutation.isPending}
                  >
                    {anonymizeLeadMutation.isPending ? 'Anonimizando...' : 'Anonimizar (Derecho al Olvido)'}
                  </button>
                </div>
                {exportLeadMutation.isSuccess && <div className="alert alert-success" style={{marginTop: '10px'}}>Exportación iniciada con éxito.</div>}
              </div>

            </div>
          ) : (
            <div className="alert alert-error">Error al cargar el prospecto.</div>
          )}
        </div>
      </aside>
      <Modal open={anonymizeOpen} onClose={() => setAnonymizeOpen(false)} title="Anonimizar prospecto">
        <div className="modal-form"><p>Se eliminarán definitivamente nombre, email, teléfono y otros datos personales de {lead?.name}. El registro estadístico se conservará y esta acción no se puede deshacer.</p>{anonymizeLeadMutation.error && <div className="alert alert-error">{anonymizeLeadMutation.error.message}</div>}<div className="modal-actions"><button className="btn btn-outline" type="button" onClick={() => setAnonymizeOpen(false)}>Cancelar</button><button className="btn btn-danger" type="button" disabled={anonymizeLeadMutation.isPending} onClick={() => lead && anonymizeLeadMutation.mutate(lead.id)}>{anonymizeLeadMutation.isPending ? 'Anonimizando...' : 'Confirmar anonimización'}</button></div></div>
      </Modal>
      <Modal open={convertOpen} onClose={() => setConvertOpen(false)} title="Convertir lead en cliente">
        <div className="modal-form"><p>Se creará la ficha de <strong>{lead?.name}</strong> en estado onboarding y este lead quedará como ganado. Luego podrás asignar responsable, brief, contrato y checklist.</p>{convertLeadMutation.error && <div className="alert alert-error">{convertLeadMutation.error.message}</div>}<div className="modal-actions"><button className="btn btn-outline" type="button" onClick={() => setConvertOpen(false)}>Cancelar</button><button className="btn btn-primary" type="button" disabled={convertLeadMutation.isPending} onClick={() => lead && convertLeadMutation.mutate(lead.id)}>{convertLeadMutation.isPending ? 'Convirtiendo...' : 'Confirmar cierre'}</button></div></div>
      </Modal>
      <Modal open={activityOpen} onClose={() => setActivityOpen(false)} title="Registrar actividad comercial">
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); createActivityMutation.mutate(); }}>
          <div className="account-form-intro"><strong>Historial compartido</strong><p>Esta actividad quedara vinculada al lead y visible para el equipo comercial.</p></div>
          {createActivityMutation.error && <div className="alert alert-error" role="alert">{createActivityMutation.error.message}</div>}
          <div className="form-row">
            <label>Tipo<select className="input" value={activityForm.type} onChange={(event) => setActivityForm({ ...activityForm, type: event.target.value })}><option value="call">Llamada</option><option value="email">Correo</option><option value="meeting">Reunion</option><option value="whatsapp">WhatsApp</option><option value="note">Nota</option></select></label>
            <label>Fecha y hora<input className="input" type="datetime-local" value={activityForm.date} onChange={(event) => setActivityForm({ ...activityForm, date: event.target.value })} /><small>Deja vacio para registrar la hora actual o elige una fecha futura para seguimiento.</small></label>
          </div>
          <label>Detalle<textarea className="input" rows={5} required maxLength={10000} value={activityForm.description} onChange={(event) => setActivityForm({ ...activityForm, description: event.target.value })} placeholder="Acuerdo, proximo paso o contexto relevante..." /></label>
          <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setActivityOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={createActivityMutation.isPending || !activityForm.description.trim()}>{createActivityMutation.isPending ? 'Guardando...' : 'Guardar actividad'}</button></div>
        </form>
      </Modal>
    </>
  );
}
