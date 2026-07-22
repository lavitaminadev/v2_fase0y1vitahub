import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../core/api';
import { StatusBadge } from '../../shared/StatusBadge';
import { Modal } from '../../shared/Modal';

const REDIRECT_URI = `${window.location.origin}/integrations/google/callback`;

interface GoogleIntegration { id: string; name: string; status: string; lastSyncAt?: string }
interface GoogleConnectCardProps { integration?: GoogleIntegration }
interface GoogleAccount { id: string; externalId: string; name: string; type?: string; selected: boolean; clientId?: string | null }
interface ClientOption { id: string; name: string }
interface GoogleStatus { configured: boolean; clientId: string | null; adsConfigured: boolean; adsApiVersion: string }
interface Feedback { tone: 'success' | 'error' | 'info'; text: string }

export function GoogleConnectCard({ integration }: GoogleConnectCardProps) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [analyticsForm, setAnalyticsForm] = useState({ propertyId: '', name: '', clientId: '' });
  const isConnected = integration?.status === 'active';

  const statusQuery = useQuery<GoogleStatus>({ queryKey: ['google-status'], queryFn: () => api.get('/integrations/google/status') });
  const authQuery = useQuery<{ url: string }>({
    queryKey: ['google-auth-url'],
    queryFn: () => api.get(`/integrations/google/auth-url?redirect_uri=${encodeURIComponent(REDIRECT_URI)}`),
    enabled: statusQuery.data?.configured === true && !isConnected,
  });
  const { data: clients = [] } = useQuery<ClientOption[]>({ queryKey: ['clients'], queryFn: () => api.get('/clients'), enabled: isConnected });
  const accountsQuery = useQuery<GoogleAccount[]>({
    queryKey: ['google-accounts', integration?.id],
    queryFn: () => api.get(`/integrations/google/${integration!.id}/accounts`),
    enabled: isConnected && Boolean(integration?.id),
  });

  const refreshMutation = useMutation({
    mutationFn: () => api.post(`/integrations/google/${integration?.id}/refresh`),
    onSuccess: async () => { setFeedback({ tone: 'success', text: 'La autorización de Google se renovó correctamente.' }); await queryClient.invalidateQueries({ queryKey: ['integrations'] }); },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });
  const disconnectMutation = useMutation({
    mutationFn: () => api.post(`/integrations/google/${integration?.id}/disconnect`),
    onSuccess: async () => {
      setDisconnectOpen(false);
      setFeedback({ tone: 'success', text: 'Google fue desconectado. Las métricas importadas se conservaron.' });
      await queryClient.invalidateQueries({ queryKey: ['integrations'] });
      queryClient.removeQueries({ queryKey: ['google-accounts', integration?.id] });
    },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });
  const discoverMutation = useMutation({
    mutationFn: () => api.post<GoogleAccount[]>(`/integrations/google/${integration?.id}/ads/discover`),
    onSuccess: async (data) => { setFeedback({ tone: 'success', text: `${data.length} cuentas de Google Ads fueron encontradas.` }); await queryClient.invalidateQueries({ queryKey: ['google-accounts', integration?.id] }); },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });
  const syncMutation = useMutation({
    mutationFn: () => api.post<{ synced: number; skippedUnassignedAccounts: string[] }>(`/integrations/google/${integration?.id}/data/sync`),
    onSuccess: async (data) => {
      const skipped = data.skippedUnassignedAccounts.length;
      setFeedback({ tone: skipped ? 'info' : 'success', text: `${data.synced} métricas sincronizadas.${skipped ? ` ${skipped} activos todavía requieren cliente.` : ''}` });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['performance'] }), queryClient.invalidateQueries({ queryKey: ['integrations'] })]);
    },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });
  const assignMutation = useMutation({
    mutationFn: ({ accountId, clientId }: { accountId: string; clientId: string }) => api.put(`/integrations/accounts/${accountId}/client`, { clientId: clientId || undefined }),
    onSuccess: async (_data, variables) => { setFeedback({ tone: 'success', text: variables.clientId ? 'Activo asociado al cliente y listo para sincronizar.' : 'Activo desasignado.' }); await queryClient.invalidateQueries({ queryKey: ['google-accounts', integration?.id] }); },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });
  const analyticsMutation = useMutation({
    mutationFn: () => api.post(`/integrations/google/${integration?.id}/analytics-properties`, { ...analyticsForm, propertyId: analyticsForm.propertyId.trim(), name: analyticsForm.name.trim() }),
    onSuccess: async () => {
      setAnalyticsForm({ propertyId: '', name: '', clientId: '' });
      setFeedback({ tone: 'success', text: 'Propiedad GA4 registrada y vinculada al cliente.' });
      await queryClient.invalidateQueries({ queryKey: ['google-accounts', integration?.id] });
    },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });

  const handleConnect = () => {
    setFeedback(null);
    if (!statusQuery.data?.configured) { setFeedback({ tone: 'error', text: 'Primero configura las credenciales OAuth de Google en el servidor.' }); return; }
    if (!authQuery.data?.url) { setFeedback({ tone: 'error', text: 'No se pudo preparar la autorización. Reintenta en unos segundos.' }); return; }
    const popup = window.open(authQuery.data.url, 'google-oauth', 'width=600,height=700');
    if (!popup) { setFeedback({ tone: 'error', text: 'El navegador bloqueó la ventana de Google. Habilita ventanas emergentes y reintenta.' }); return; }
    setConnecting(true);
    let finished = false;
    const cleanup = () => { if (finished) return; finished = true; setConnecting(false); window.clearInterval(timer); window.removeEventListener('message', handleMessage); };
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.provider !== 'google') return;
      if (event.data?.type === 'oauth:success') setFeedback({ tone: 'success', text: 'Google quedó conectado correctamente.' });
      else if (event.data?.type === 'oauth:error') setFeedback({ tone: 'error', text: event.data?.error || 'Google no autorizó la conexión.' });
      else return;
      void queryClient.invalidateQueries({ queryKey: ['integrations'] }); cleanup();
    };
    window.addEventListener('message', handleMessage);
    const timer = window.setInterval(() => { if (popup.closed) { void queryClient.invalidateQueries({ queryKey: ['integrations'] }); cleanup(); } }, 800);
  };

  const accounts = accountsQuery.data ?? [];
  const adsAccounts = accounts.filter((account) => !account.type || account.type === 'ad_account');
  const analyticsAccounts = accounts.filter((account) => account.type === 'analytics_property');
  const assignedAccounts = accounts.filter((account) => account.selected && account.clientId).length;

  return (
    <div className="integration-card google-card">
      <div className="integration-header">
        <span className="integration-icon" aria-hidden="true">G</span>
        <div className="integration-info"><div className="integration-name">Google Workspace y Marketing</div><div className="integration-provider">Una autorización para Ads, Analytics, Drive y Calendar</div></div>
        <StatusBadge status={isConnected ? 'active' : 'disconnected'} />
      </div>

      {statusQuery.isLoading && <div className="alert alert-info">Verificando la configuración de Google...</div>}
      {statusQuery.error && <div className="alert alert-error" role="alert">No se pudo verificar la configuración de Google.</div>}
      {statusQuery.data && !statusQuery.data.configured && <div className="alert alert-warning"><strong>Conexión pendiente.</strong> El administrador del servidor debe agregar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.</div>}
      {feedback && <div className={`alert alert-${feedback.tone}`} role="alert">{feedback.text}</div>}

      <div className="google-service-grid">
        <article className={isConnected && statusQuery.data?.adsConfigured ? 'ready' : ''}><span>ADS</span><div><strong>Google Ads</strong><small>{isConnected ? (statusQuery.data?.adsConfigured ? `${adsAccounts.length} cuentas detectadas` : 'Falta Developer Token') : 'Requiere conexión'}</small></div><i>{isConnected && statusQuery.data?.adsConfigured ? '✓' : '!'}</i></article>
        <article className={isConnected ? 'ready' : ''}><span>GA4</span><div><strong>Analytics</strong><small>{isConnected ? `${analyticsAccounts.length} propiedades vinculadas` : 'Requiere conexión'}</small></div><i>{isConnected ? '✓' : '!'}</i></article>
        <article className={isConnected ? 'ready' : ''}><span>DRV</span><div><strong>Google Drive</strong><small>{isConnected ? 'Carpetas y cargas habilitadas' : 'Requiere conexión'}</small></div><i>{isConnected ? '✓' : '!'}</i></article>
        <article className={isConnected ? 'ready' : ''}><span>CAL</span><div><strong>Calendar</strong><small>{isConnected ? 'Agenda y reservas habilitadas' : 'Requiere conexión'}</small></div><i>{isConnected ? '✓' : '!'}</i></article>
      </div>

      {isConnected && statusQuery.data && <div className="meta-health-strip"><div className="meta-health-item"><span>OAuth</span><strong>Conectado</strong></div><div className="meta-health-item"><span>API Ads</span><strong>{statusQuery.data.adsApiVersion}</strong></div><div className="meta-health-item"><span>Activos asociados</span><strong>{assignedAccounts}/{accounts.length}</strong></div><div className="meta-health-item"><span>Última actividad</span><strong>{integration?.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleDateString('es-CL') : 'Pendiente'}</strong></div></div>}

      <div className="integration-actions">
        {!isConnected ? <button className="btn btn-primary" onClick={handleConnect} disabled={connecting || !statusQuery.data?.configured || authQuery.isLoading}>{connecting ? 'Esperando autorización...' : 'Conectar con Google'}</button> : <><button className="btn btn-outline" onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>Renovar acceso</button><button className="btn btn-outline" onClick={() => discoverMutation.mutate()} disabled={discoverMutation.isPending || !statusQuery.data?.adsConfigured}>{discoverMutation.isPending ? 'Descubriendo...' : 'Descubrir cuentas Ads'}</button><button className="btn btn-primary" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending || assignedAccounts === 0}>{syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar datos'}</button><button className="btn btn-outline btn-danger" onClick={() => setDisconnectOpen(true)}>Desconectar</button></>}
      </div>

      {isConnected && <>
        <section className="integration-section">
          <div className="integration-section-heading"><div><h4>Cuentas de Google Ads</h4><p className="page-subtitle">Descubre las cuentas y asigna cada una al cliente correcto.</p></div>{accountsQuery.isFetching && <span className="page-subtitle">Actualizando...</span>}</div>
          {accountsQuery.error && <div className="alert alert-error">No se pudieron recuperar los activos guardados.</div>}
          {!accountsQuery.isLoading && adsAccounts.length === 0 && <div className="asset-empty"><strong>No hay cuentas importadas.</strong><span>Usa “Descubrir cuentas Ads” para consultar las cuentas accesibles.</span></div>}
          {adsAccounts.length > 0 && <div className="asset-list">{adsAccounts.map((account) => <div className="asset-item" key={account.id}><span><strong>{account.name}</strong><small>{account.externalId}</small></span><select className="input asset-client-select" aria-label={`Cliente para ${account.name}`} value={account.clientId ?? ''} onChange={(event) => assignMutation.mutate({ accountId: account.id, clientId: event.target.value })} disabled={assignMutation.isPending}><option value="">Sin asignar</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>)}</div>}
        </section>

        <section className="integration-section google-analytics-section">
          <div className="integration-section-heading"><div><h4>Propiedades Google Analytics 4</h4><p className="page-subtitle">GA4 no permite descubrir propiedades con el mismo flujo. Registra el ID visible en Administrar → Detalles de la propiedad.</p></div></div>
          <form className="analytics-register-form" onSubmit={(event) => { event.preventDefault(); analyticsMutation.mutate(); }}>
            <label>ID de propiedad<input className="input" inputMode="numeric" pattern="(properties/)?[0-9]+" placeholder="Ej. 123456789" value={analyticsForm.propertyId} onChange={(event) => setAnalyticsForm({ ...analyticsForm, propertyId: event.target.value })} required /></label>
            <label>Nombre identificador<input className="input" placeholder="Web principal" value={analyticsForm.name} onChange={(event) => setAnalyticsForm({ ...analyticsForm, name: event.target.value })} required /></label>
            <label>Cliente<select className="input" value={analyticsForm.clientId} onChange={(event) => setAnalyticsForm({ ...analyticsForm, clientId: event.target.value })} required><option value="">Selecciona cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
            <button className="btn btn-primary" disabled={analyticsMutation.isPending}>{analyticsMutation.isPending ? 'Vinculando...' : 'Vincular propiedad'}</button>
          </form>
          {analyticsAccounts.length > 0 && <div className="asset-list compact">{analyticsAccounts.map((account) => <div className="asset-item" key={account.id}><span><strong>{account.name}</strong><small>GA4 · {account.externalId}</small></span><select className="input asset-client-select" aria-label={`Cliente para ${account.name}`} value={account.clientId ?? ''} onChange={(event) => assignMutation.mutate({ accountId: account.id, clientId: event.target.value })} disabled={assignMutation.isPending}><option value="">Sin asignar</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>)}</div>}
        </section>

        <div className="google-workspace-actions"><Link to="/documents"><span>DRV</span><div><strong>Gestionar documentos y Drive</strong><small>Crear estructura por cliente y subir archivos</small></div><i>→</i></Link><Link to="/meetings"><span>CAL</span><div><strong>Abrir reuniones y Calendar</strong><small>Agenda operativa y eventos sincronizados</small></div><i>→</i></Link></div>
      </>}

      <Modal open={disconnectOpen} onClose={() => setDisconnectOpen(false)} title="Desconectar Google"><div className="modal-form"><p>Se revocará el acceso y se eliminarán los tokens guardados. Las métricas ya importadas se conservarán.</p>{disconnectMutation.error && <div className="alert alert-error">{disconnectMutation.error.message}</div>}<div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setDisconnectOpen(false)}>Cancelar</button><button type="button" className="btn btn-danger" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>{disconnectMutation.isPending ? 'Desconectando...' : 'Confirmar desconexión'}</button></div></div></Modal>
    </div>
  );
}
