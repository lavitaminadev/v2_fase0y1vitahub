import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { Modal } from '../../shared/Modal';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { MonthlyReportCard } from './MonthlyReportCard';
import type { MonthlyReport } from './monthly-report.types';

interface ClientOption { id: string; name: string }
const now = new Date();

export function MonthlyReportsPanel() {
  const qc = useQueryClient();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editing, setEditing] = useState<MonthlyReport | null>(null);
  const [publishing, setPublishing] = useState<MonthlyReport | null>(null);
  const [clientId, setClientId] = useState('');
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() || 12));
  const [summary, setSummary] = useState('');
  const [insights, setInsights] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [salesGenerated, setSalesGenerated] = useState('0');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const { data: reports = [], isLoading, error } = useQuery<MonthlyReport[]>({ queryKey: ['monthly-reports'], queryFn: () => api.get('/reporting/monthly-reports') });
  const { data: clients = [] } = useQuery<ClientOption[]>({ queryKey: ['clients'], queryFn: () => api.get('/clients') });
  const refresh = async (text: string) => { await qc.invalidateQueries({ queryKey: ['monthly-reports'] }); setFeedback({ tone: 'success', text }); };
  const generate = useMutation({ mutationFn: () => api.post('/reporting/monthly-reports/generate', { clientId, year: Number(year), month: Number(month) }), onSuccess: async () => { setGenerateOpen(false); await refresh('Reporte generado con datos reales. Revísalo antes de publicarlo.'); }, onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }) });
  const update = useMutation({ mutationFn: () => api.put(`/reporting/monthly-reports/${editing!.id}`, { executiveSummary: summary, insights: insights.split('\n').map((value) => value.trim()).filter(Boolean), recommendations, salesGenerated: Number(salesGenerated) }), onSuccess: async () => { setEditing(null); await refresh('Contenido editorial guardado.'); }, onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }) });
  const publish = useMutation({ mutationFn: () => api.post(`/reporting/monthly-reports/${publishing!.id}/${publishing!.status === 'published' ? 'unpublish' : 'publish'}`, {}), onSuccess: async () => { const wasPublished = publishing?.status === 'published'; setPublishing(null); await refresh(wasPublished ? 'Reporte devuelto a borrador.' : 'Reporte publicado en el portal del cliente.'); }, onError: (mutationError: Error) => { setPublishing(null); setFeedback({ tone: 'error', text: mutationError.message }); } });
  const openEdit = (report: MonthlyReport) => { setEditing(report); setSummary(report.executiveSummary ?? ''); setInsights((report.insights ?? []).join('\n')); setRecommendations(report.recommendations ?? ''); setSalesGenerated(String(report.salesGenerated ?? 0)); };

  return <section className="monthly-reports-workspace">
    <header><div><span className="page-eyebrow">ENTREGA AL CLIENTE</span><h2>Informes mensuales</h2><p>Genera una base automática, agrega lectura estratégica y publica solo cuando esté revisada.</p></div><button className="btn btn-primary" onClick={() => { setFeedback(null); setGenerateOpen(true); }}>+ Generar informe</button></header>
    <div className="report-publish-flow"><span><b>1</b> Consolidar datos</span><span><b>2</b> Revisar narrativa</span><span><b>3</b> Publicar al cliente</span><span><b>4</b> Imprimir / PDF</span></div>
    {feedback && <div className={`alert alert-${feedback.tone}`}>{feedback.text}</div>}
    {error && <div className="alert alert-error">No fue posible cargar los informes: {error.message}</div>}
    {isLoading ? <p className="muted">Cargando informes mensuales...</p> : reports.length ? <div className="monthly-reports-grid">{reports.map((report) => <MonthlyReportCard key={report.id} report={report} actions={<><button className="btn btn-sm btn-outline" disabled={report.status === 'published'} onClick={() => openEdit(report)}>Editar</button><button className="btn btn-sm btn-outline" onClick={() => setPublishing(report)}>{report.status === 'published' ? 'Volver a borrador' : 'Publicar'}</button><button className="btn btn-sm btn-outline" onClick={() => window.print()}>PDF</button></>} />)}</div> : <div className="panel-empty"><strong>Aún no hay informes mensuales</strong><span>Genera el primero; VITAHUB consolidará campañas, reservas, producción y reuniones.</span></div>}
    <Modal open={generateOpen} onClose={() => setGenerateOpen(false)} title="Generar informe mensual"><form className="modal-form" onSubmit={(event) => { event.preventDefault(); generate.mutate(); }}><label>Cliente<select required className="input" value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Selecciona un cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><div className="form-row"><label>Año<input className="input" type="number" min="2020" max="2100" required value={year} onChange={(event) => setYear(event.target.value)} /></label><label>Mes<select className="input" value={month} onChange={(event) => setMonth(event.target.value)}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2026, index, 1).toLocaleDateString('es-CL', { month: 'long' })}</option>)}</select></label></div><p className="form-context">Se recalcularán métricas del período. Si el informe está publicado, primero debes devolverlo a borrador.</p><button className="btn btn-primary btn-block" disabled={generate.isPending}>{generate.isPending ? 'Consolidando...' : 'Generar con datos reales'}</button></form></Modal>
    <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Revisión editorial"><form className="modal-form" onSubmit={(event) => { event.preventDefault(); update.mutate(); }}><label>Resumen ejecutivo<textarea className="input" rows={5} value={summary} onChange={(event) => setSummary(event.target.value)} /></label><label>Hallazgos, uno por línea<textarea className="input" rows={5} value={insights} onChange={(event) => setInsights(event.target.value)} placeholder="Qué funcionó\nQué cambió\nQué requiere decisión" /></label><label>Recomendaciones<textarea className="input" rows={4} value={recommendations} onChange={(event) => setRecommendations(event.target.value)} /></label><label>Ventas atribuidas CLP<input className="input" type="number" min="0" value={salesGenerated} onChange={(event) => setSalesGenerated(event.target.value)} /></label><button className="btn btn-primary btn-block" disabled={update.isPending}>{update.isPending ? 'Guardando...' : 'Guardar revisión'}</button></form></Modal>
    <ConfirmDialog open={Boolean(publishing)} title={publishing?.status === 'published' ? 'Volver a borrador' : 'Publicar informe'} description={publishing?.status === 'published' ? 'El cliente dejará de verlo hasta una nueva publicación.' : 'El informe quedará disponible inmediatamente en el portal del cliente. Confirma que cifras y narrativa ya fueron revisadas.'} confirmLabel={publishing?.status === 'published' ? 'Ocultar del portal' : 'Publicar al cliente'} pending={publish.isPending} onClose={() => setPublishing(null)} onConfirm={() => publishing && publish.mutate()} />
  </section>;
}
