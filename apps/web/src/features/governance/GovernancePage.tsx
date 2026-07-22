import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { Modal } from '../../shared/Modal';
import { AuditPanel } from './AuditPanel';

interface WorkflowStep { key: string; label: string; responsibleRole?: string; slaHours?: number; required: boolean }
interface Workflow { id: string; code: string; name: string; description?: string; steps: WorkflowStep[]; isActive: boolean; version: number }
interface UserOption { id: string; name: string; role: string; workMode?: string }
interface ClientOption { id: string; name: string; status: string }
interface Pod { id: string; name: string; description?: string; leaderId?: string; status: string; monthlyCapacityUd: number; members: UserOption[]; clients: ClientOption[] }
type Feedback = { tone: 'success' | 'error'; text: string } | null;

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administración', commercial_director: 'Dirección comercial', creative_director: 'Dirección creativa', operations_director: 'Dirección de operaciones',
  art_director: 'Dirección de arte', av_director: 'Dirección audiovisual', ai_lead: 'Automatización', community_manager: 'Community manager', designer: 'Diseño', audiovisual: 'Audiovisual', client: 'Cliente',
};

function newStep(index: number): WorkflowStep { return { key: `etapa_${index + 1}`, label: `Nueva etapa ${index + 1}`, required: true }; }

export function GovernancePage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'workflows' | 'pods' | 'audit'>('workflows');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [workflowDraft, setWorkflowDraft] = useState<Workflow | null>(null);
  const [editingPod, setEditingPod] = useState<Pod | null>(null);
  const [podOpen, setPodOpen] = useState(false);
  const [podDraft, setPodDraft] = useState({ name: '', description: '', leaderId: '', monthlyCapacityUd: 80, memberIds: [] as string[], clientIds: [] as string[] });

  const workflowsQuery = useQuery<Workflow[]>({ queryKey: ['workflows'], queryFn: () => api.get('/workflows') });
  const podsQuery = useQuery<Pod[]>({ queryKey: ['pods'], queryFn: () => api.get('/pods') });
  const usersQuery = useQuery<UserOption[]>({ queryKey: ['governance-users'], queryFn: () => api.get('/users?isActive=true') });
  const clientsQuery = useQuery<ClientOption[]>({ queryKey: ['clients'], queryFn: () => api.get('/clients') });

  const workflowMutation = useMutation({
    mutationFn: (workflow: Workflow) => api.put(`/workflows/${workflow.id}`, { name: workflow.name, description: workflow.description, isActive: workflow.isActive, steps: workflow.steps }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['workflows'] }); setEditingWorkflow(null); setWorkflowDraft(null); setFeedback({ tone: 'success', text: 'Flujo actualizado. Las nuevas operaciones usarán esta versión.' }); },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });
  const resetWorkflowMutation = useMutation({
    mutationFn: (code: string) => api.post(`/workflows/${code}/reset`),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['workflows'] }); setFeedback({ tone: 'success', text: 'Flujo restaurado según el Documento Maestro.' }); },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });
  const podMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: podDraft.name.trim(), description: podDraft.description.trim() || undefined, leaderId: podDraft.leaderId || undefined, monthlyCapacityUd: podDraft.monthlyCapacityUd };
      const pod = editingPod ? await api.put<Pod>(`/pods/${editingPod.id}`, payload) : await api.post<Pod>('/pods', payload);
      await api.put(`/pods/${pod.id}/members`, { userIds: podDraft.memberIds });
      await api.put(`/pods/${pod.id}/clients`, { clientIds: podDraft.clientIds });
      return pod;
    },
    onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['pods'] }), queryClient.invalidateQueries({ queryKey: ['operations'] }), queryClient.invalidateQueries({ queryKey: ['clients'] })]); setPodOpen(false); setEditingPod(null); setFeedback({ tone: 'success', text: 'Pod guardado con sus integrantes y cuentas.' }); },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });
  const archivePodMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/pods/${id}`),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['pods'] }); setFeedback({ tone: 'success', text: 'Pod archivado sin perder su historial.' }); },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });

  const users = (usersQuery.data ?? []).filter((user) => user.role !== 'client');
  const clients = clientsQuery.data ?? [];
  const openWorkflow = (workflow: Workflow) => { const copy = structuredClone(workflow); setEditingWorkflow(workflow); setWorkflowDraft(copy); setFeedback(null); };
  const moveStep = (index: number, direction: -1 | 1) => setWorkflowDraft((current) => {
    if (!current) return current; const target = index + direction; if (target < 0 || target >= current.steps.length) return current;
    const steps = [...current.steps]; [steps[index], steps[target]] = [steps[target], steps[index]]; return { ...current, steps };
  });
  const updateStep = (index: number, patch: Partial<WorkflowStep>) => setWorkflowDraft((current) => current ? { ...current, steps: current.steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step) } : current);
  const openPod = (pod?: Pod) => { setEditingPod(pod ?? null); setPodDraft(pod ? { name: pod.name, description: pod.description ?? '', leaderId: pod.leaderId ?? '', monthlyCapacityUd: Number(pod.monthlyCapacityUd), memberIds: pod.members.map((item) => item.id), clientIds: pod.clients.map((item) => item.id) } : { name: '', description: '', leaderId: '', monthlyCapacityUd: 80, memberIds: [], clientIds: [] }); setPodOpen(true); setFeedback(null); };
  const toggle = (key: 'memberIds' | 'clientIds', id: string) => setPodDraft((current) => ({ ...current, [key]: current[key].includes(id) ? current[key].filter((value) => value !== id) : [...current[key], id] }));

  if (workflowsQuery.isLoading || podsQuery.isLoading || usersQuery.isLoading || clientsQuery.isLoading) return <LoadingSpinner text="Preparando gobernanza operativa..." />;
  const loadError = workflowsQuery.error || podsQuery.error || usersQuery.error || clientsQuery.error;
  if (loadError) return <div className="page"><div className="page-load-error"><span>!</span><h1>No pudimos abrir la gobernanza</h1><p>{loadError.message}</p></div></div>;

  return <div className="page governance-page">
    <section className="governance-hero"><div><span className="page-eyebrow">CONTROL ADMINISTRATIVO</span><h1>La operación se adapta sin perder estructura.</h1><p>Define cómo trabaja el equipo, quién responde y cuánto puede absorber cada pod. Los cambios se aplican a futuras operaciones.</p></div><div className="governance-summary"><span><small>Flujos</small><strong>{workflowsQuery.data?.length ?? 0}</strong></span><span><small>Pods activos</small><strong>{podsQuery.data?.filter((pod) => pod.status === 'active').length ?? 0}</strong></span><span><small>Cuentas asignadas</small><strong>{podsQuery.data?.reduce((sum, pod) => sum + pod.clients.length, 0) ?? 0}</strong></span></div></section>
    <nav className="governance-tabs"><button className={tab === 'workflows' ? 'active' : ''} onClick={() => setTab('workflows')}><span>01</span><strong>Flujos operativos</strong><small>Etapas, responsables y SLA</small></button><button className={tab === 'pods' ? 'active' : ''} onClick={() => setTab('pods')}><span>02</span><strong>Pods y capacidad</strong><small>Equipo y cartera de cuentas</small></button><button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}><span>03</span><strong>Auditoría</strong><small>Cambios, actores y evidencia</small></button></nav>
    {feedback && <div className={`alert alert-${feedback.tone}`}>{feedback.text}</div>}

    {tab === 'workflows' && <section className="workflow-grid">{workflowsQuery.data?.map((workflow) => <article className="workflow-card" key={workflow.id}><header><div><span>{workflow.code.replaceAll('_', ' ')}</span><h2>{workflow.name}</h2></div><i>v{workflow.version}</i></header><p>{workflow.description}</p><ol>{workflow.steps.slice(0, 6).map((step, index) => <li key={`${step.key}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{step.label}</strong><small>{step.responsibleRole ? ROLE_LABELS[step.responsibleRole] ?? step.responsibleRole : 'Responsable por asignar'}{step.slaHours ? ` · ${step.slaHours} h` : ''}</small></div></li>)}</ol>{workflow.steps.length > 6 && <div className="workflow-more">+ {workflow.steps.length - 6} etapas adicionales</div>}<footer><button className="btn btn-primary btn-sm" onClick={() => openWorkflow(workflow)}>Configurar flujo</button><button className="btn btn-outline btn-sm" onClick={() => resetWorkflowMutation.mutate(workflow.code)} disabled={resetWorkflowMutation.isPending}>Restaurar base</button></footer></article>)}</section>}

    {tab === 'pods' && <section><div className="section-toolbar"><div><span className="page-eyebrow">ESTRUCTURA DE CUENTAS</span><h2>Pods operativos</h2></div><button className="btn btn-primary" onClick={() => openPod()}>+ Crear pod</button></div>{!podsQuery.data?.length ? <div className="governance-empty"><strong>Aún no hay pods</strong><p>Crea el primero, define su capacidad y asigna equipo y clientes.</p><button className="btn btn-primary" onClick={() => openPod()}>Crear primer pod</button></div> : <div className="pod-governance-grid">{podsQuery.data.map((pod) => { const demand = pod.clients.reduce((sum, client) => sum + Number((client as ClientOption & { defaultUdBudget?: number }).defaultUdBudget ?? 0), 0); const usage = Math.min(100, Math.round(demand / Math.max(Number(pod.monthlyCapacityUd), 1) * 100)); return <article key={pod.id}><header><div><span className={`status-dot ${pod.status}`} /><div><h3>{pod.name}</h3><small>{pod.description || 'Sin descripción'}</small></div></div><strong>{usage}%</strong></header><div className="pod-capacity"><i style={{ width: `${usage}%` }} /></div><div className="pod-facts"><span><small>Capacidad</small><strong>{Number(pod.monthlyCapacityUd)} UD</strong></span><span><small>Integrantes</small><strong>{pod.members.length}</strong></span><span><small>Cuentas</small><strong>{pod.clients.length}</strong></span></div><div className="pod-people">{pod.members.slice(0, 5).map((member) => <span key={member.id} title={member.name}>{member.name.slice(0, 2).toUpperCase()}</span>)}{pod.members.length > 5 && <span>+{pod.members.length - 5}</span>}</div><footer><button className="btn btn-outline btn-sm" onClick={() => openPod(pod)}>Editar estructura</button><button className="btn btn-outline btn-sm" onClick={() => archivePodMutation.mutate(pod.id)}>Archivar</button></footer></article>; })}</div>}</section>}

    {tab === 'audit' && <AuditPanel />}

    <Modal open={Boolean(editingWorkflow && workflowDraft)} onClose={() => { setEditingWorkflow(null); setWorkflowDraft(null); }} title={`Configurar ${editingWorkflow?.name ?? 'flujo'}`}>
      {workflowDraft && <form className="modal-form workflow-editor" onSubmit={(event) => { event.preventDefault(); workflowMutation.mutate(workflowDraft); }}><div className="workflow-editor-intro"><strong>Versión {workflowDraft.version + 1}</strong><p>Reordena etapas, asigna responsables y define tiempos objetivo. Los casos ya iniciados conservan su historial.</p></div><label>Nombre del flujo<input className="input" required value={workflowDraft.name} onChange={(event) => setWorkflowDraft({ ...workflowDraft, name: event.target.value })} /></label><label>Descripción<textarea className="input" rows={2} value={workflowDraft.description ?? ''} onChange={(event) => setWorkflowDraft({ ...workflowDraft, description: event.target.value })} /></label><div className="workflow-step-editor">{workflowDraft.steps.map((step, index) => <article key={`${step.key}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div className="workflow-step-fields"><input className="input" aria-label={`Nombre etapa ${index + 1}`} value={step.label} onChange={(event) => updateStep(index, { label: event.target.value, key: event.target.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || step.key })} /><select className="input" value={step.responsibleRole ?? ''} onChange={(event) => updateStep(index, { responsibleRole: event.target.value || undefined })}><option value="">Responsable por asignar</option>{Object.entries(ROLE_LABELS).filter(([role]) => role !== 'client').map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select><input className="input" type="number" min={1} max={8760} placeholder="SLA horas" value={step.slaHours ?? ''} onChange={(event) => updateStep(index, { slaHours: event.target.value ? Number(event.target.value) : undefined })} /></div><div className="workflow-step-actions"><button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0}>↑</button><button type="button" onClick={() => moveStep(index, 1)} disabled={index === workflowDraft.steps.length - 1}>↓</button><button type="button" className="danger" onClick={() => setWorkflowDraft({ ...workflowDraft, steps: workflowDraft.steps.filter((_, itemIndex) => itemIndex !== index) })} disabled={workflowDraft.steps.length === 1}>×</button></div></article>)}</div><button className="btn btn-outline" type="button" onClick={() => setWorkflowDraft({ ...workflowDraft, steps: [...workflowDraft.steps, newStep(workflowDraft.steps.length)] })}>+ Agregar etapa</button><div className="modal-actions"><button className="btn btn-outline" type="button" onClick={() => { setEditingWorkflow(null); setWorkflowDraft(null); }}>Cancelar</button><button className="btn btn-primary" disabled={workflowMutation.isPending}>{workflowMutation.isPending ? 'Guardando...' : 'Publicar nueva versión'}</button></div></form>}
    </Modal>

    <Modal open={podOpen} onClose={() => setPodOpen(false)} title={editingPod ? `Editar ${editingPod.name}` : 'Crear pod operativo'}>
      <form className="modal-form pod-editor" onSubmit={(event) => { event.preventDefault(); podMutation.mutate(); }}><div className="form-row"><label>Nombre<input className="input" required minLength={2} value={podDraft.name} onChange={(event) => setPodDraft({ ...podDraft, name: event.target.value })} /></label><label>Capacidad mensual UD<input className="input" type="number" min={1} required value={podDraft.monthlyCapacityUd} onChange={(event) => setPodDraft({ ...podDraft, monthlyCapacityUd: Number(event.target.value) })} /></label></div><label>Propósito del pod<textarea className="input" rows={2} value={podDraft.description} onChange={(event) => setPodDraft({ ...podDraft, description: event.target.value })} /></label><label>Líder de cuenta<select className="input" value={podDraft.leaderId} onChange={(event) => setPodDraft({ ...podDraft, leaderId: event.target.value })}><option value="">Seleccionar líder</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name} · {ROLE_LABELS[user.role] ?? user.role}</option>)}</select></label><div className="pod-assignment-grid"><fieldset><legend>Integrantes <span>{podDraft.memberIds.length}</span></legend><div className="check-list">{users.map((user) => <label key={user.id}><input type="checkbox" checked={podDraft.memberIds.includes(user.id)} onChange={() => toggle('memberIds', user.id)} /><span><strong>{user.name}</strong><small>{ROLE_LABELS[user.role] ?? user.role}</small></span></label>)}</div></fieldset><fieldset><legend>Cuentas <span>{podDraft.clientIds.length}</span></legend><div className="check-list">{clients.map((client) => <label key={client.id}><input type="checkbox" checked={podDraft.clientIds.includes(client.id)} onChange={() => toggle('clientIds', client.id)} /><span><strong>{client.name}</strong><small>{client.status}</small></span></label>)}</div></fieldset></div>{podMutation.error && <div className="alert alert-error">{podMutation.error.message}</div>}<div className="modal-actions"><button className="btn btn-outline" type="button" onClick={() => setPodOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={podMutation.isPending}>{podMutation.isPending ? 'Guardando estructura...' : 'Guardar pod'}</button></div></form>
    </Modal>
  </div>;
}
