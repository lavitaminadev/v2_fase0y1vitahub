import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { CloudinaryConfigModal } from './CloudinaryConfigModal';

type SettingsTab = 'general' | 'access';
type SettingValue = string | number | boolean | null;
type Feedback = { tone: 'success' | 'error'; text: string } | null;

interface OrganizationSummary {
  id: string;
  name: string;
}

interface SettingOption {
  value: string;
  label: string;
}

interface OrganizationSetting {
  key: string;
  category: 'operation' | 'production' | 'design_budget' | 'meetings' | 'alerts' | 'documents';
  label: string;
  description: string;
  valueType: 'boolean' | 'number' | 'select' | 'text';
  value: SettingValue;
  defaultValue: SettingValue;
  masterStatus: 'master_defined' | 'direction_required';
  source: 'organization' | 'master_default';
  version: number;
  options?: SettingOption[];
  min?: number;
  max?: number;
  unit?: string;
  nullable?: boolean;
}

interface SystemHealth {
  status: 'ok' | 'degraded';
  database: { status: string; connected: boolean };
  disk: { status: string; writable: boolean };
}

const TABS: Array<{ id: SettingsTab; number: string; label: string; description: string }> = [
  { id: 'general', number: '01', label: 'Identidad', description: 'Perfil y organización' },
  { id: 'access', number: '02', label: 'Sistema Fase 1', description: 'Empresas, usuarios, Meta y Cloudinary' },
];

const TAB_CATEGORIES: Partial<Record<string, OrganizationSetting['category'][]>> = {
  operation: ['operation', 'production', 'design_budget'],
  communication: ['meetings', 'alerts'],
  documents: ['documents'],
};

const GROUP_COPY: Record<OrganizationSetting['category'], { kicker: string; title: string; description: string }> = {
  operation: { kicker: 'Responsabilidad', title: 'Modelo de trabajo', description: 'Deja explícito cómo se distribuye la responsabilidad de cada cuenta.' },
  production: { kicker: 'Trazabilidad', title: 'Reglas de producción', description: 'Controla los puntos del flujo donde VITAHUB debe alertar o registrar un cobro extra.' },
  design_budget: { kicker: 'Capacidad', title: 'Presupuesto de diseño', description: 'Define cómo se interpreta, comunica y protege el saldo de unidades de diseño.' },
  meetings: { kicker: 'Ritmo', title: 'Cadencia de reuniones', description: 'Mantiene una referencia común para el seguimiento operativo con clientes.' },
  alerts: { kicker: 'Prevención', title: 'Avisos de operación', description: 'Establece con cuánta anticipación se debe comunicar un riesgo de entrega.' },
  documents: { kicker: 'Fuente de verdad', title: 'Archivos y versiones', description: 'Protege la trazabilidad desde el archivo de trabajo hasta el final aprobado.' },
};

function currentValue(setting: OrganizationSetting, draft: Record<string, SettingValue>): SettingValue {
  return Object.hasOwn(draft, setting.key) ? draft[setting.key] : setting.value;
}

function SettingControl({
  setting,
  value,
  onChange,
}: {
  setting: OrganizationSetting;
  value: SettingValue;
  onChange: (value: SettingValue) => void;
}) {
  if (setting.valueType === 'boolean') {
    return (
      <label className="central-switch">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span aria-hidden="true" />
        <strong>{value ? 'Activado' : 'Desactivado'}</strong>
      </label>
    );
  }

  if (setting.valueType === 'select') {
    return (
      <select className="input" value={String(value ?? '')} onChange={(event) => onChange(event.target.value)}>
        {setting.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  }

  if (setting.valueType === 'number') {
    return (
      <div className="setting-number-field">
        <input
          className="input"
          type="number"
          min={setting.min}
          max={setting.max}
          value={typeof value === 'number' ? value : ''}
          placeholder={setting.nullable ? 'Sin definir' : undefined}
          onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
        />
        {setting.unit && <span>{setting.unit}</span>}
      </div>
    );
  }

  return <input className="input" value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />;
}

function RulesView({
  settings,
  draft,
  categories,
  onChange,
  onReset,
}: {
  settings: OrganizationSetting[];
  draft: Record<string, SettingValue>;
  categories: OrganizationSetting['category'][];
  onChange: (key: string, value: SettingValue) => void;
  onReset: (setting: OrganizationSetting) => void;
}) {
  return (
    <div className="settings-rule-groups">
      {categories.map((category) => {
        const group = settings.filter((setting) => setting.category === category);
        if (!group.length) return null;
        const copy = GROUP_COPY[category];
        return (
          <section className="settings-rule-group" key={category}>
            <header>
              <span>{copy.kicker}</span>
              <h2>{copy.title}</h2>
              <p>{copy.description}</p>
            </header>
            <div className="settings-rule-list">
              {group.map((setting) => {
                const value = currentValue(setting, draft);
                const changed = JSON.stringify(value) !== JSON.stringify(setting.value);
                return (
                  <article className={`settings-rule ${changed ? 'is-changed' : ''}`} key={setting.key}>
                    <div className="settings-rule-copy">
                      <div className="settings-rule-meta">
                        <span className={`rule-status ${setting.masterStatus}`}>
                          {setting.masterStatus === 'master_defined' ? 'Documento Maestro' : 'Decisión de dirección'}
                        </span>
                        <span className="rule-source">
                          {setting.source === 'organization' ? `Personalizada · v${setting.version}` : 'Valor base'}
                        </span>
                      </div>
                      <h3>{setting.label}</h3>
                      <p>{setting.description}</p>
                    </div>
                    <div className="settings-rule-control">
                      <SettingControl setting={setting} value={value} onChange={(next) => onChange(setting.key, next)} />
                      {changed && <button type="button" className="setting-reset" onClick={() => onReset(setting)}>Deshacer</button>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function SettingsPage() {
  const { user, logout, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [profile, setProfile] = useState({ name: user?.name ?? '', email: user?.email ?? '' });
  const [orgName, setOrgName] = useState('');
  const [draft, setDraft] = useState<Record<string, SettingValue>>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [cloudinaryOpen, setCloudinaryOpen] = useState(false);

  const organizationsQuery = useQuery<OrganizationSummary[]>({
    queryKey: ['organizations'],
    queryFn: () => api.get('/organizations'),
  });
  const settingsQuery = useQuery<OrganizationSetting[]>({
    queryKey: ['organization-settings'],
    queryFn: () => api.get('/settings'),
  });
  const healthQuery = useQuery<SystemHealth>({
    queryKey: ['system-health'],
    queryFn: () => api.get('/health'),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    setProfile({ name: user?.name ?? '', email: user?.email ?? '' });
  }, [user?.email, user?.name]);

  useEffect(() => {
    const currentOrg = organizationsQuery.data?.find((organization) => organization.id === user?.organizationId)
      ?? organizationsQuery.data?.[0];
    if (currentOrg) setOrgName(currentOrg.name);
  }, [organizationsQuery.data, user?.organizationId]);

  const profileMutation = useMutation({
    mutationFn: () => api.put('/auth/profile', { name: profile.name.trim(), email: profile.email.trim() }),
    onSuccess: async () => {
      await refreshProfile();
      setFeedback({ tone: 'success', text: 'Tu perfil quedó actualizado.' });
    },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });

  const organizationMutation = useMutation({
    mutationFn: () => api.put('/organizations/profile', { name: orgName.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setFeedback({ tone: 'success', text: 'La identidad de la organización quedó actualizada.' });
    },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });

  const settingsMutation = useMutation({
    mutationFn: (values: Record<string, SettingValue>) => api.put<OrganizationSetting[]>('/settings', { values }),
    onSuccess: (settings) => {
      queryClient.setQueryData(['organization-settings'], settings);
      setDraft({});
      setFeedback({ tone: 'success', text: 'Reglas guardadas y registradas en la auditoría.' });
    },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });

  const settings = settingsQuery.data ?? [];
  const changedValues = Object.fromEntries(
    settings
      .filter((setting) => Object.hasOwn(draft, setting.key) && JSON.stringify(draft[setting.key]) !== JSON.stringify(setting.value))
      .map((setting) => [setting.key, draft[setting.key]]),
  );
  const changeCount = Object.keys(changedValues).length;
  const pendingDecisions = settings.filter((setting) => setting.masterStatus === 'direction_required' && setting.source === 'master_default').length;
  const customizedRules = settings.filter((setting) => setting.source === 'organization').length;
  const systemReady = healthQuery.data?.status === 'ok' && healthQuery.data.database.connected && healthQuery.data.disk.writable;

  const changeSetting = (key: string, value: SettingValue) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setFeedback(null);
  };

  return (
    <div className="page settings-central">
      <section className="settings-hero">
        <div>
          <span className="page-eyebrow">CONFIGURACIÓN CENTRAL</span>
          <h1>Base simple para operar reservas y conversiones.</h1>
          <p>Administra identidad, accesos, empresas, Meta Pixel y Cloudinary sin abrir módulos que todavía no corresponden a Fase 1.</p>
        </div>
        <div className="settings-hero-mark" aria-hidden="true"><span>LV</span><small>control</small></div>
      </section>

      <section className="settings-health-grid" aria-label="Resumen de configuración">
        <article><span>Reglas guardadas</span><strong>{settings.length || '—'}</strong><small>{customizedRules} personalizadas para esta organización</small></article>
        <article className={pendingDecisions ? 'attention' : ''}><span>Decisiones pendientes</span><strong>{settingsQuery.isLoading ? '—' : pendingDecisions}</strong><small>Se mantienen como referencia interna, no como menú activo</small></article>
        <article className={systemReady ? 'ready' : 'attention'}><span>Estado del sistema</span><strong>{healthQuery.isLoading ? 'Revisando' : systemReady ? 'Operativo' : 'Atención'}</strong><small>API, base de datos y escritura local</small></article>
      </section>

      <nav className="settings-tabs" aria-label="Secciones de configuración">
        {TABS.map((tab) => (
          <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => { setActiveTab(tab.id); setFeedback(null); }}>
            <span>{tab.number}</span><strong>{tab.label}</strong><small>{tab.description}</small>
          </button>
        ))}
      </nav>

      {feedback && <div className={`settings-feedback alert alert-${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.text}</div>}

      {activeTab === 'general' && (
        <div className="settings-identity-grid">
          <section className="settings-form-card">
            <header><span>Tu cuenta</span><h2>Perfil personal</h2><p>Esta información identifica tus acciones en comentarios, aprobaciones y auditorías.</p></header>
            <form onSubmit={(event) => { event.preventDefault(); profileMutation.mutate(); }}>
              <label>Nombre completo<input className="input" required value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label>
              <label>Correo de acceso<input className="input" required type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label>
              <div className="settings-form-note"><span>Rol</span><strong>{user?.role.replaceAll('_', ' ')}</strong><small>Los permisos del rol se administran en Equipo y accesos.</small></div>
              <button className="btn btn-primary" type="submit" disabled={profileMutation.isPending || !profile.name.trim() || !profile.email.trim()}>
                {profileMutation.isPending ? 'Guardando...' : 'Guardar perfil'}
              </button>
            </form>
          </section>

          <section className="settings-form-card organization-card">
            <header><span>Espacio de trabajo</span><h2>Identidad de La Vitamina</h2><p>El nombre se utiliza en paneles, reportes y comunicaciones internas de la organización.</p></header>
            <form onSubmit={(event) => { event.preventDefault(); organizationMutation.mutate(); }}>
              <label>Nombre de la organización<input className="input" required value={orgName} onChange={(event) => setOrgName(event.target.value)} /></label>
              <div className="organization-preview"><span>Vista previa</span><div><b>V</b><p><strong>{orgName || 'La Vitamina'}</strong><small>Espacio operativo VITAHUB</small></p></div></div>
              <button className="btn btn-primary" type="submit" disabled={organizationMutation.isPending || !orgName.trim()}>
                {organizationMutation.isPending ? 'Actualizando...' : 'Actualizar organización'}
              </button>
            </form>
          </section>
        </div>
      )}

      {TAB_CATEGORIES[activeTab] && (
        settingsQuery.isLoading
          ? <LoadingSpinner text="Preparando reglas operativas..." />
          : settingsQuery.isError
            ? <section className="settings-load-error"><span>!</span><h2>No pudimos cargar la configuración</h2><p>{settingsQuery.error.message}</p><button className="btn btn-primary" onClick={() => settingsQuery.refetch()}>Intentar nuevamente</button></section>
            : <RulesView settings={settings} draft={draft} categories={TAB_CATEGORIES[activeTab]!} onChange={changeSetting} onReset={(setting) => setDraft((current) => { const next = { ...current }; delete next[setting.key]; return next; })} />
      )}

      {activeTab === 'access' && (
        <div className="settings-access-grid">
          <Link to="/clients" className="settings-access-card"><span>01</span><div><strong>Empresas y permisos</strong><p>Define qué funciones usa cada empresa: reservas, CRM y Meta Pixel + CAPI.</p></div><b>Configurar →</b></Link>
          <Link to="/users" className="settings-access-card"><span>02</span><div><strong>Usuarios y accesos</strong><p>Crea cuentas, asócialas a empresa, bloquea accesos y fuerza cambio de contraseña inicial.</p></div><b>Administrar →</b></Link>
          <Link to="/integrations" className="settings-access-card"><span>03</span><div><strong>Meta Pixel + CAPI</strong><p>Gestiona Pixels por empresa, tokens CAPI, evento de prueba y diagnóstico de conversiones.</p></div><b>Ver Meta →</b></Link>
          <button type="button" className="settings-access-card" onClick={() => setCloudinaryOpen(true)}><span>04</span><div><strong>Cloudinary global</strong><p>Configura la cuenta compartida para subir logos e imágenes de fondo de los formularios públicos.</p></div><b>Configurar →</b></button>
          <section className="settings-session-card"><span>SESIÓN ACTUAL</span><strong>{user?.email}</strong><p>Al cerrar sesión se revoca el acceso del navegador y se elimina la credencial segura.</p><button className="btn btn-outline" type="button" onClick={logout}>Cerrar sesión de forma segura</button></section>
        </div>
      )}

      <CloudinaryConfigModal open={cloudinaryOpen} onClose={() => setCloudinaryOpen(false)} />

      {changeCount > 0 && (
        <div className="settings-save-bar" role="status">
          <div><span>{changeCount}</span><p><strong>{changeCount === 1 ? 'Cambio sin guardar' : 'Cambios sin guardar'}</strong><small>Se aplicarán a toda la organización y quedarán auditados.</small></p></div>
          <div><button type="button" className="btn btn-outline" onClick={() => setDraft({})}>Descartar</button><button type="button" className="btn btn-primary" disabled={settingsMutation.isPending} onClick={() => settingsMutation.mutate(changedValues)}>{settingsMutation.isPending ? 'Aplicando...' : 'Guardar reglas'}</button></div>
        </div>
      )}
    </div>
  );
}
