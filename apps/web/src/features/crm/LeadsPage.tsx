import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { StatusBadge } from '../../shared/StatusBadge';
import { statusLabel } from '../../shared/status-labels';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { EmptyState } from '../../shared/EmptyState';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { LeadDetailDrawer } from './components/LeadDetailDrawer';
import { matchesSearch } from '../../shared/search';
import { Modal } from '../../shared/Modal';
import { CrmNav } from './CrmNav';
import { useSearchParams } from 'react-router-dom';

interface Lead {
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
  metadata?: {
    customDisclaimerResponses?: unknown[];
    scoringSignals?: string[];
  };
  createdAt?: string;
}

const STATUSES = ['new', 'contacted', 'meeting_scheduled', 'quote_sent', 'negotiation', 'won', 'lost'];
const ACTIVE_STATUSES = ['new', 'contacted', 'meeting_scheduled', 'quote_sent', 'negotiation'];
const FIT_FILTERS = ['all', 'qualified', 'review', 'discarded'] as const;
type PipelineView = 'board' | 'list';
type LeadUpdate = { status?: string; fitStatus?: string; discardReason?: string };

const SOURCE_LABELS: Record<string, string> = {
  meta: 'Meta', meta_lead_ads: 'Meta Lead Ads', google_ads: 'Google Ads', reservation: 'Reservas',
  website: 'Sitio web', referral: 'Referido', manual: 'Ingreso manual',
};

function leadInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'LV';
}

function leadDate(value?: string): string {
  return value ? new Date(value).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha';
}

export function LeadsPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [fitFilter, setFitFilter] = useState<(typeof FIT_FILTERS)[number]>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [pipelineView, setPipelineView] = useState<PipelineView>('board');
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(() => new Set());
  const [bulkStatus, setBulkStatus] = useState('contacted');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [pageId, setPageId] = useState('');
  const [leadgenId, setLeadgenId] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(searchParams.get('focus'));
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === '1');
  const [leadForm, setLeadForm] = useState({ name: '', email: '', phone: '', company: '', source: 'manual', notes: '' });

  const { data: leads, isLoading, error, refetch, isFetching } = useQuery<Lead[]>({
    queryKey: ['leads'],
    queryFn: () => api.get('/crm/leads'),
  });

  const visibleLeads = useMemo(() => {
    if (!leads) return [];
    return leads.filter((lead) =>
      (fitFilter === 'all' || lead.fitStatus === fitFilter) &&
      (!statusFilter || lead.status === statusFilter) &&
      (!sourceFilter || lead.source === sourceFilter) &&
      matchesSearch(search, [lead.name, lead.email, lead.phone, lead.company, lead.source, lead.sourceDetail, lead.campaignName]),
    );
  }, [fitFilter, leads, search, sourceFilter, statusFilter]);

  const sourceOptions = useMemo(
    () => [...new Set((leads ?? []).map((lead) => lead.source).filter((value): value is string => Boolean(value)))].sort(),
    [leads],
  );

  const selectedVisibleIds = useMemo(
    () => visibleLeads.filter((lead) => selectedLeadIds.has(lead.id)).map((lead) => lead.id),
    [selectedLeadIds, visibleLeads],
  );
  const allVisibleSelected = visibleLeads.length > 0 && selectedVisibleIds.length === visibleLeads.length;

  const grouped = useMemo(
    () =>
      STATUSES.reduce<Record<string, Lead[]>>((acc, status) => {
        acc[status] = visibleLeads.filter((lead) => lead.status === status);
        return acc;
      }, {}),
    [visibleLeads],
  );

  const summary = useMemo(() => {
    const allLeads = leads ?? [];
    return {
      total: allLeads.length,
      qualified: allLeads.filter((lead) => lead.fitStatus === 'qualified').length,
      review: allLeads.filter((lead) => lead.fitStatus === 'review').length,
      discarded: allLeads.filter((lead) => lead.fitStatus === 'discarded').length,
    };
  }, [leads]);

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      status,
      fitStatus,
      discardReason,
    }: {
      id: string;
      status?: string;
      fitStatus?: string;
      discardReason?: string;
    }) => api.put(`/crm/leads/${id}`, { status, fitStatus, discardReason }),
    onSuccess: () => { setFeedback(null); return queryClient.invalidateQueries({ queryKey: ['leads'] }); },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: LeadUpdate; successMessage: string }) => {
      const results = await Promise.allSettled(ids.map((id) => api.put(`/crm/leads/${id}`, patch)));
      const failedIds = ids.filter((_, index) => results[index]?.status === 'rejected');
      return { updated: ids.length - failedIds.length, failedIds };
    },
    onSuccess: async (result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (result.failedIds.length > 0) {
        setSelectedLeadIds(new Set(result.failedIds));
        setFeedback({
          tone: 'error',
          text: `Se actualizaron ${result.updated} leads. ${result.failedIds.length} no pudieron modificarse y siguen seleccionados para reintentar.`,
        });
        return;
      }
      setSelectedLeadIds(new Set());
      setFeedback({ tone: 'success', text: variables.successMessage });
    },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const toggleLeadSelection = (id: string) => {
    setSelectedLeadIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedLeadIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleLeads.forEach((lead) => next.delete(lead.id));
      else visibleLeads.forEach((lead) => next.add(lead.id));
      return next;
    });
  };

  const createMutation = useMutation({
    mutationFn: () => api.post('/crm/leads', {
      name: leadForm.name.trim(),
      email: leadForm.email.trim() || undefined,
      phone: leadForm.phone.trim() || undefined,
      company: leadForm.company.trim() || undefined,
      source: leadForm.source,
      notes: leadForm.notes.trim() || undefined,
    }),
    onSuccess: async () => {
      setCreateOpen(false);
      setLeadForm({ name: '', email: '', phone: '', company: '', source: 'manual', notes: '' });
      setFeedback({ tone: 'success', text: 'Lead creado y agregado al pipeline.' });
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const syncLeadMutation = useMutation({
    mutationFn: (payload: { pageId: string; leadgenId: string }) => api.post('/integrations/meta/leads/sync', payload),
    onSuccess: () => {
      setPageId('');
      setLeadgenId('');
      setFeedback({ tone: 'success', text: 'Lead descargado, normalizado y evaluado correctamente.' });
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  if (isLoading) return <LoadingSpinner text="Cargando leads..." />;
  if (error) return <QueryErrorState title="No pudimos cargar los leads" message={error.message} onRetry={() => void refetch()} retrying={isFetching} />;

  return (
    <div className="page">
      <CrmNav />
      <div className="page-header"><div><span className="page-eyebrow">CRM COMERCIAL</span><h1>Pipeline comercial</h1><p className="page-subtitle">Prioriza prospectos útiles, registra su origen y avanza cada oportunidad con evidencia.</p></div><button type="button" className="btn btn-primary" onClick={() => { setFeedback(null); setCreateOpen(true); }}>+ Nuevo lead</button></div>

      <div className="card-grid">
        <div className="card">
          <div className="card-title">Leads totales</div>
          <div className="card-value">{summary.total}</div>
        </div>
        <div className="card">
          <div className="card-title">Calificados</div>
          <div className="card-value">{summary.qualified}</div>
        </div>
        <div className="card">
          <div className="card-title">En revision</div>
          <div className="card-value">{summary.review}</div>
        </div>
        <div className="card">
          <div className="card-title">Descartados</div>
          <div className="card-value">{summary.discarded}</div>
        </div>
      </div>

      {feedback && <div className={`alert alert-${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.text}</div>}

      <div className="filters crm-filter-bar">
        <input className="input" aria-label="Buscar leads" placeholder="Buscar persona, empresa, campaña o contacto..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="input" aria-label="Filtrar por calidad" value={fitFilter} onChange={(e) => setFitFilter(e.target.value as (typeof FIT_FILTERS)[number])}>
          <option value="all">Todos los leads</option>
          <option value="qualified">Solo calificados</option>
          <option value="review">Solo revision</option>
          <option value="discarded">Solo descartados</option>
        </select>
        <select className="input" aria-label="Filtrar por etapa" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">Todas las etapas</option>
          {STATUSES.map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}
        </select>
        <select className="input" aria-label="Filtrar por origen" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
          <option value="">Todos los orígenes</option>
          {sourceOptions.map((source) => <option value={source} key={source}>{SOURCE_LABELS[source] ?? statusLabel(source)}</option>)}
        </select>
        <button type="button" className="btn btn-outline btn-sm" disabled={!search && fitFilter === 'all' && !statusFilter && !sourceFilter} onClick={() => { setSearch(''); setFitFilter('all'); setStatusFilter(''); setSourceFilter(''); }}>Limpiar</button>
        <span className="filter-result-count">{visibleLeads.length} resultado{visibleLeads.length === 1 ? '' : 's'}</span>
      </div>

      <details className="crm-operations-panel">
        <summary>
          <span><strong>Integración y cumplimiento</strong><small>Sincronización manual de Meta, validación del flujo y control de datos.</small></span>
          <span className="crm-operations-summary-action">Ver herramientas</span>
        </summary>
        <div className="crm-operations-body">
        <div className="crm-flow-grid">
          <div className="card crm-sync-card">
          <h3>Sincronizar lead de Meta</h3>
          <p className="page-subtitle">
            Usa <code>pageId</code> y <code>leadgenId</code> reales para disparar la descarga completa del lead y verificar el flujo de punta a punta.
          </p>
          <div className="modal-form">
            <label>
              Page ID
              <input className="input" value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="1234567890" />
            </label>
            <label>
              Leadgen ID
              <input className="input" value={leadgenId} onChange={(e) => setLeadgenId(e.target.value)} placeholder="9876543210" />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => syncLeadMutation.mutate({ pageId, leadgenId })}
              disabled={!pageId || !leadgenId || syncLeadMutation.isPending}
            >
              {syncLeadMutation.isPending ? 'Sincronizando...' : 'Sincronizar lead real'}
            </button>
            <p className="page-subtitle">
              Uso controlado para soporte y validacion. Este endpoint opera con limite por minuto y debe usarse solo con IDs reales autorizados.
            </p>
          </div>
          </div>

          <div className="card crm-sync-card">
          <h3>Flujo verificado</h3>
          <div className="status-flow crm-flow-steps">
            <span className="step">Meta Lead Ads</span>
            <span className="arrow">{'->'}</span>
            <span className="step">Webhook leadgen</span>
            <span className="arrow">{'->'}</span>
            <span className="step">Descarga detalle</span>
            <span className="arrow">{'->'}</span>
            <span className="step">Score y filtro</span>
            <span className="arrow">{'->'}</span>
            <span className="step">Contacto</span>
            <span className="arrow">{'->'}</span>
            <span className="step">Oportunidad</span>
          </div>
          <p className="crm-flow-note">
            Los leads utiles crean base comercial minima automaticamente. Los no utiles quedan descartados con motivo para no contaminar el pipeline.
          </p>
          </div>
        </div>

        <div className="card crm-sync-card">
          <h3>Control de cumplimiento</h3>
          <div className="portal-list">
            <div className="crm-related-item">
              <strong>Consentimiento y origen</strong>
              <span>Cada lead debe conservar trazabilidad de formulario, pagina y fecha de captura.</span>
            </div>
            <div className="crm-related-item">
              <strong>Eliminacion y anonimizado</strong>
              <span>Las acciones manuales del CRM deben usar exportacion o anonimizado, no borrado silencioso.</span>
            </div>
            <div className="crm-related-item">
              <strong>Retencion operativa</strong>
              <span>Los leads descartados deben revisarse por fecha de retencion antes de seguir usando sus datos.</span>
            </div>
          </div>
        </div>
        </div>
      </details>

      {visibleLeads.length === 0 ? (
        <EmptyState
          icon="[]"
          title="Sin leads en este filtro"
          description="Ajusta el filtro o conecta Meta Lead Ads para empezar a poblar el pipeline con prospectos reales."
        />
      ) : (
        <>
          <section className="crm-pipeline-workspace" aria-labelledby="crm-pipeline-heading">
            <header className="crm-pipeline-header">
              <div><span className="page-eyebrow">MESA COMERCIAL</span><h2 id="crm-pipeline-heading">Leads en movimiento</h2><p>Selecciona varios prospectos para calificarlos o moverlos de etapa sin perder trazabilidad.</p></div>
              <div className="crm-view-switch" role="group" aria-label="Vista del pipeline">
                <button type="button" className={pipelineView === 'board' ? 'active' : ''} aria-pressed={pipelineView === 'board'} onClick={() => setPipelineView('board')}>Tablero</button>
                <button type="button" className={pipelineView === 'list' ? 'active' : ''} aria-pressed={pipelineView === 'list'} onClick={() => setPipelineView('list')}>Lista</button>
              </div>
            </header>
            <div className="crm-board-toolbar">
              <div className="crm-board-legend" aria-label="Leyenda de calidad">
                <span className="crm-legend-chip"><span className="crm-legend-dot is-qualified" /> Util comercial</span>
                <span className="crm-legend-chip"><span className="crm-legend-dot is-review" /> Revision manual</span>
                <span className="crm-legend-chip"><span className="crm-legend-dot is-discarded" /> Descartado</span>
              </div>
              <span className="crm-selection-hint">{selectedVisibleIds.length > 0 ? `${selectedVisibleIds.length} seleccionados` : pipelineView === 'board' ? 'Arrastra para cambiar de etapa' : 'Selecciona filas para editar en lote'}</span>
            </div>
          {pipelineView === 'board' ? (
          <div className="kanban crm-pipeline-board" aria-label="Pipeline comercial por etapas">
            {STATUSES.map((status) => (
              <div
                key={status}
                className={`kanban-column crm-stage-column ${dropStatus === status ? 'is-drop-target' : ''}`}
                onDragOver={(event) => {
                  if (status === 'won') return;
                  event.preventDefault();
                  setDropStatus(status);
                }}
                onDragLeave={() => {
                  if (dropStatus === status) setDropStatus(null);
                }}
                onDrop={() => {
                  if (!dragLeadId) return;
                  if (status === 'won') {
                    setSelectedLeadId(dragLeadId);
                    setFeedback({ tone: 'info', text: 'Para cerrar como ganado, abre la ficha y usa Convertir en cliente.' });
                    return;
                  }
                  setDropStatus(null);
                  setDragLeadId(null);
                  updateMutation.mutate({ id: dragLeadId, status });
                }}
              >
                <div className="kanban-header crm-stage-header">
                  <div><StatusBadge status={status} /><small>{Math.round(((grouped[status]?.length ?? 0) / visibleLeads.length) * 100)}% visible</small></div>
                  <span className="kanban-count">{grouped[status]?.length ?? 0}</span>
                </div>

                <div className="kanban-cards">
                  {(grouped[status]?.length ?? 0) === 0 && <div className="kanban-empty">Suelta un lead aqui</div>}
                  {(grouped[status] ?? []).map((lead) => (
                    <article
                      key={lead.id}
                      draggable
                      data-fit-status={lead.fitStatus}
                      className={`kanban-card lead-card ${selectedLeadId === lead.id ? 'lead-card-selected' : ''} ${selectedLeadIds.has(lead.id) ? 'is-bulk-selected' : ''} ${dragLeadId === lead.id ? 'is-dragging' : ''}`}
                      onDragStart={() => {
                        setDragLeadId(lead.id);
                        setSelectedLeadId(lead.id);
                      }}
                      onDragEnd={() => {
                        setDragLeadId(null);
                        setDropStatus(null);
                      }}
                    >
                      <div className="crm-lead-card-head">
                        <label className="crm-select-control" title="Seleccionar lead">
                          <input type="checkbox" checked={selectedLeadIds.has(lead.id)} onChange={() => toggleLeadSelection(lead.id)} aria-label={`Seleccionar a ${lead.name}`} />
                        </label>
                        <button type="button" className="crm-lead-open" onClick={() => setSelectedLeadId(lead.id)} aria-label={`Abrir ficha de ${lead.name}`}>
                          <span className="crm-lead-avatar" aria-hidden="true">{leadInitials(lead.name)}</span>
                          <span><strong>{lead.name}</strong><small>{lead.company || 'Sin empresa informada'}</small></span>
                        </button>
                      </div>
                      <div className="lead-card-meta">
                        <StatusBadge status={lead.fitStatus} />
                        <span className={`lead-score ${lead.qualityScore >= 70 ? 'lead-score-good' : lead.qualityScore >= 35 ? 'lead-score-mid' : 'lead-score-bad'}`}>
                          Score {lead.qualityScore}
                        </span>
                      </div>
                      <div className="kanban-card-info">{lead.email || lead.phone || 'Sin canal de contacto'}</div>
                      <div className="kanban-card-info">{lead.sourceDetail || (lead.source ? SOURCE_LABELS[lead.source] ?? statusLabel(lead.source) : 'Origen no informado')}</div>
                      {lead.campaignName && <div className="kanban-card-info">Campana: {lead.campaignName}</div>}
                      <div className="kanban-card-info">Ingreso: {leadDate(lead.createdAt)}</div>
                      {lead.consentCapturedAt && <div className="kanban-card-info is-consent">Consentimiento registrado</div>}
                      {lead.discardReason && <div className="lead-discard-reason">{lead.discardReason}</div>}
                      {lead.notes && <div className="lead-note-preview">{lead.notes.split('\n')[0]}</div>}

                      <div className="kanban-card-actions crm-card-stage-actions">
                        {ACTIVE_STATUSES.indexOf(status) > 0 && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              updateMutation.mutate({ id: lead.id, status: ACTIVE_STATUSES[ACTIVE_STATUSES.indexOf(status) - 1] });
                            }}
                          >
                            Anterior
                          </button>
                        )}
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setSelectedLeadId(lead.id)}>Ver ficha</button>
                        {ACTIVE_STATUSES.includes(status) && status !== 'negotiation' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              updateMutation.mutate({ id: lead.id, status: ACTIVE_STATUSES[ACTIVE_STATUSES.indexOf(status) + 1] });
                            }}
                          >
                            Siguiente
                          </button>
                        )}
                        {status === 'negotiation' && <button type="button" className="btn btn-sm btn-primary" onClick={() => setSelectedLeadId(lead.id)}>Cerrar venta</button>}
                      </div>

                      <div className="kanban-card-actions crm-card-fit-actions">
                        {lead.fitStatus !== 'qualified' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={(event) => {
                              event.stopPropagation();
                              updateMutation.mutate({ id: lead.id, fitStatus: 'qualified', discardReason: '' });
                            }}
                          >
                            Marcar util
                          </button>
                        )}
                        {lead.fitStatus !== 'review' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              updateMutation.mutate({ id: lead.id, fitStatus: 'review', discardReason: '' });
                            }}
                          >
                            En revision
                          </button>
                        )}
                        {lead.fitStatus !== 'discarded' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline btn-danger"
                            onClick={(event) => {
                              event.stopPropagation();
                              updateMutation.mutate({
                                id: lead.id,
                                fitStatus: 'discarded',
                                discardReason: lead.discardReason || 'Descartado por revision comercial.',
                                status: status === 'won' ? status : 'lost',
                              });
                            }}
                          >
                            Descartar
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
          ) : (
            <div className="table-wrapper crm-lead-table-wrap">
              <table className="data-table crm-lead-table">
                <thead>
                  <tr>
                    <th className="crm-select-column">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        ref={(input) => { if (input) input.indeterminate = selectedVisibleIds.length > 0 && !allVisibleSelected; }}
                        onChange={toggleAllVisible}
                        aria-label="Seleccionar todos los leads visibles"
                      />
                    </th>
                    <th>Lead</th><th>Origen</th><th>Etapa</th><th>Calidad</th><th>Ingreso</th><th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLeads.map((lead) => (
                    <tr key={lead.id} className={selectedLeadIds.has(lead.id) ? 'is-selected' : ''}>
                      <td data-label="Seleccionar" className="crm-select-column"><input type="checkbox" checked={selectedLeadIds.has(lead.id)} onChange={() => toggleLeadSelection(lead.id)} aria-label={`Seleccionar a ${lead.name}`} /></td>
                      <td data-label="Lead"><div className="crm-lead-person"><span className="crm-lead-avatar" aria-hidden="true">{leadInitials(lead.name)}</span><span><strong>{lead.name}</strong><small>{lead.company || lead.email || lead.phone || 'Sin datos adicionales'}</small></span></div></td>
                      <td data-label="Origen"><div className="crm-table-stack"><strong>{lead.sourceDetail || (lead.source ? SOURCE_LABELS[lead.source] ?? statusLabel(lead.source) : 'Sin origen')}</strong><small>{lead.campaignName || 'Sin campana asociada'}</small></div></td>
                      <td data-label="Etapa"><StatusBadge status={lead.status} /></td>
                      <td data-label="Calidad"><div className="crm-quality-cell"><StatusBadge status={lead.fitStatus} /><span className="crm-score-meter" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(0, lead.qualityScore))}%` }} /></span><small>{lead.qualityScore}/100</small></div></td>
                      <td data-label="Ingreso">{leadDate(lead.createdAt)}</td>
                      <td data-label="Accion"><button type="button" className="btn btn-sm btn-outline" onClick={() => setSelectedLeadId(lead.id)}>Ver ficha</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </section>

          {selectedVisibleIds.length > 0 && (
            <div className="crm-bulk-bar" role="region" aria-label="Acciones para leads seleccionados">
              <div className="crm-bulk-count"><strong>{selectedVisibleIds.length}</strong><span>lead{selectedVisibleIds.length === 1 ? '' : 's'} seleccionado{selectedVisibleIds.length === 1 ? '' : 's'}</span></div>
              <div className="crm-bulk-actions">
                <button type="button" className="btn btn-sm btn-light" disabled={bulkUpdateMutation.isPending} onClick={() => bulkUpdateMutation.mutate({ ids: selectedVisibleIds, patch: { fitStatus: 'qualified', discardReason: '' }, successMessage: `${selectedVisibleIds.length} leads marcados como utiles.` })}>Marcar utiles</button>
                <button type="button" className="btn btn-sm btn-light" disabled={bulkUpdateMutation.isPending} onClick={() => bulkUpdateMutation.mutate({ ids: selectedVisibleIds, patch: { fitStatus: 'review', discardReason: '' }, successMessage: `${selectedVisibleIds.length} leads enviados a revision.` })}>Enviar a revision</button>
                <div className="crm-bulk-stage">
                  <select className="input" value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)} aria-label="Etapa de destino">
                    {STATUSES.filter((status) => status !== 'won').map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                  </select>
                  <button type="button" className="btn btn-sm btn-accent" disabled={bulkUpdateMutation.isPending} onClick={() => bulkUpdateMutation.mutate({ ids: selectedVisibleIds, patch: { status: bulkStatus }, successMessage: `${selectedVisibleIds.length} leads movidos a ${statusLabel(bulkStatus).toLowerCase()}.` })}>{bulkUpdateMutation.isPending ? 'Aplicando...' : 'Mover etapa'}</button>
                </div>
                <button type="button" className="crm-bulk-clear" disabled={bulkUpdateMutation.isPending} onClick={() => setSelectedLeadIds(new Set())}>Limpiar</button>
              </div>
            </div>
          )}

          <LeadDetailDrawer leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />
        </>
      )}

      <div className="status-diagram">
        <h3>Flujo operativo</h3>
        <div className="status-flow">
          <span className="step">Nuevo</span><span className="arrow">{'->'}</span>
          <span className="step">Contactado</span><span className="arrow">{'->'}</span>
          <span className="step">Reunion agendada</span><span className="arrow">{'->'}</span>
          <span className="step">Presupuesto enviado</span><span className="arrow">{'->'}</span>
          <span className="step">Negociacion</span><span className="arrow">{'->'}</span>
          <span className="step">Ganado</span>
          <span className="arrow">/</span>
          <span className="step lost">Perdido</span>
        </div>
      </div>
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo lead manual">
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}>
          <div className="account-form-intro"><strong>Ingreso comercial directo</strong><p>Úsalo para referidos, llamadas, formularios externos o contactos que no provienen de Meta.</p></div>
          {createMutation.error && <div className="alert alert-error">{createMutation.error.message}</div>}
          <label>Nombre<input className="input" required minLength={2} maxLength={255} value={leadForm.name} onChange={(event) => setLeadForm({ ...leadForm, name: event.target.value })} /></label>
          <div className="form-row"><label>Email<input className="input" type="email" value={leadForm.email} onChange={(event) => setLeadForm({ ...leadForm, email: event.target.value })} /></label><label>Teléfono<input className="input" type="tel" value={leadForm.phone} onChange={(event) => setLeadForm({ ...leadForm, phone: event.target.value })} /></label></div>
          <div className="form-row"><label>Empresa<input className="input" value={leadForm.company} onChange={(event) => setLeadForm({ ...leadForm, company: event.target.value })} /></label><label>Origen<select className="input" value={leadForm.source} onChange={(event) => setLeadForm({ ...leadForm, source: event.target.value })}><option value="manual">Ingreso manual</option><option value="referral">Referido</option><option value="website">Sitio web</option><option value="event">Evento</option><option value="other">Otro</option></select></label></div>
          <label>Contexto inicial<textarea className="input" rows={4} value={leadForm.notes} onChange={(event) => setLeadForm({ ...leadForm, notes: event.target.value })} /></label>
          <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setCreateOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={createMutation.isPending || leadForm.name.trim().length < 2}>{createMutation.isPending ? 'Creando...' : 'Crear lead'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
