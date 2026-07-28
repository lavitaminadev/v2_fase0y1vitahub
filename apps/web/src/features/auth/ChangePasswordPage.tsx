import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';

const PASSWORD_RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: 'Al menos 8 caracteres', test: (v) => v.length >= 8 },
  { label: 'Al menos 1 mayuscula', test: (v) => /[A-Z]/.test(v) },
  { label: 'Al menos 1 minuscula', test: (v) => /[a-z]/.test(v) },
  { label: 'Al menos 1 numero', test: (v) => /\d/.test(v) },
];

const TERMS = [
  { key: 'terms', label: 'Acepto los Terminos y Condiciones de uso de la plataforma VITAHUB' },
  { key: 'dataTreatment', label: 'Acepto la Politica de Tratamiento de Datos Personales' },
  { key: 'confidentiality', label: 'Acepto el Acuerdo de Confidencialidad y No Divulgacion' },
  { key: 'properUse', label: 'Me comprometo al buen uso de la aplicacion y sus funcionalidades' },
  { key: 'noDisclosure', label: 'No compartire, expondre ni divulgare informacion interna de la plataforma' },
] as const;

function PasswordField({ label, value, onChange, required, showRules }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; showRules?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <label>{label}
      <div className="input-group">
        <input className="input" type={visible ? 'text' : 'password'} required={required} minLength={8} value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="btn btn-icon" onClick={() => setVisible(!visible)} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
          {visible ? '🙈' : '👁'}
        </button>
      </div>
      {showRules && value.length > 0 && (
        <ul className="password-rules">
          {PASSWORD_RULES.map((rule) => (
            <li key={rule.label} className={rule.test(value) ? 'passed' : 'pending'}>{rule.test(value) ? '✓' : '○'} {rule.label}</li>
          ))}
        </ul>
      )}
    </label>
  );
}

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const refreshProfile = useAuth((state) => state.refreshProfile);
  const user = useAuth((state) => state.user);
  const canReadOrganizations = ['admin', 'commercial_director', 'operations_director'].includes(user?.role ?? '');
  const { data: orgs } = useQuery<Array<{ id: string; name: string; logoUrl?: string; welcomeMessage?: string }>>({ queryKey: ['organizations'], queryFn: () => api.get('/organizations'), enabled: canReadOrganizations });
  const org = orgs?.[0];
  /**
   * Una renovación no es un primer ingreso: la cuenta ya está activa y solo debe aceptar
   * el texto vigente. Pedirle la contraseña temporal no tendría sentido, porque hace
   * tiempo que no la usa.
   */
  const isRenewal = Boolean(user?.mustAcceptTerms) && !user?.mustChangePassword && !user?.mustCompleteProfile;
  const [step, setStep] = useState<'welcome' | 'profile' | 'terms' | 'password'>(isRenewal ? 'terms' : 'welcome');
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [termsError, setTermsError] = useState('');
  const [profile, setProfile] = useState({ name: user?.name ?? '', phone: '', workMode: '' });
  const [profileError, setProfileError] = useState('');
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const allRulesPassed = useMemo(() => PASSWORD_RULES.every((r) => r.test(form.newPassword)), [form.newPassword]);
  const allTermsAccepted = TERMS.every((t) => accepted[t.key]);

  /**
   * Envía el primer ingreso completo en una sola operación.
   *
   * Datos, consentimientos y contraseña viajan juntos porque el backend los guarda en una
   * transacción: no puede quedar una cuenta con la contraseña cambiada pero sin registro
   * de que aceptó las condiciones.
   */
  const submitOnboarding = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.newPassword !== form.confirm) { setFeedback('Las contraseñas nuevas no coinciden.'); return; }
    if (!allRulesPassed) { setFeedback('La nueva contraseña no cumple los requisitos minimos de seguridad.'); return; }
    setSaving(true); setFeedback(null);
    try {
      await api.post('/auth/onboarding', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
        acceptedConsents: TERMS.filter((term) => accepted[term.key]).map((term) => term.key),
        profile: {
          name: profile.name.trim(),
          phone: profile.phone.trim() || undefined,
          workMode: profile.workMode || undefined,
        },
      });
      await refreshProfile();
      navigate(user?.role === 'client' ? '/portal' : '/dashboard', { replace: true });
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'No se pudo completar el primer ingreso.'); }
    finally { setSaving(false); }
  };

  // Step 1: Welcome
  if (step === 'welcome') {
    return <main className="auth-page"><section className="login-card password-card onboarding-card">
      {org?.logoUrl && <img src={org.logoUrl} alt={org.name} className="onboarding-logo" />}
      <span className="page-eyebrow">BIENVENIDO{user?.name ? `, ${user.name.split(' ')[0].toUpperCase()}` : ''}</span>
      <h1>{org?.name || 'VITAHUB'}</h1>
      <p>{org?.welcomeMessage || 'Revisa y acepta las politicas internas.'}</p>
      <div className="onboarding-features">
        <div><span>🔒</span><strong>Confidencialidad</strong><small>Información de clientes protegida.</small></div>
        <div><span>📋</span><strong>Terminos claros</strong><small>Reglas simples para el buen uso de la plataforma.</small></div>
        <div><span>🛡</span><strong>Datos protegidos</strong><small>Cumplimos con la normativa de proteccion de datos.</small></div>
      </div>
      <button className="btn btn-primary btn-block" onClick={() => setStep('profile')}>Comenzar</button>
      <button type="button" className="auth-secondary-link" onClick={async () => { await useAuth.getState().logout(); navigate('/login', { replace: true }); }}>← Volver al inicio de sesion</button>
    </section></main>;
  }

  // Paso 1: la persona confirma y completa sus propios datos.
  if (step === 'profile') {
    return <main className="auth-page"><section className="login-card password-card onboarding-card">
      <span className="page-eyebrow">PASO 1 DE 3</span>
      <h1>Confirma tus datos</h1>
      <p>Los completas tú, no administración. Revisa que estén correctos antes de continuar.</p>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (profile.name.trim().length < 3) { setProfileError('Escribe tu nombre completo.'); return; }
        setProfileError(''); setStep('terms');
      }}>
        <div className="form-group">
          <label htmlFor="onboarding-name">Nombre completo</label>
          <input id="onboarding-name" className="input" required autoFocus value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
        </div>
        <div className="form-group">
          <label htmlFor="onboarding-phone">Teléfono de contacto</label>
          <input id="onboarding-phone" className="input" type="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} placeholder="+56 9 1234 5678" />
          <small className="form-hint">Opcional. Se usa para avisos operativos, nunca se comparte con clientes.</small>
        </div>
        <div className="form-group">
          <label htmlFor="onboarding-workmode">Modalidad de trabajo</label>
          <select id="onboarding-workmode" className="input" value={profile.workMode} onChange={(event) => setProfile({ ...profile, workMode: event.target.value })}>
            <option value="">Prefiero no indicarlo</option>
            <option value="presential">Presencial</option>
            <option value="hybrid">Híbrida</option>
            <option value="remote">Remota</option>
          </select>
        </div>
        {profileError && <div className="alert alert-error">{profileError}</div>}
        <button className="btn btn-primary btn-block">Continuar</button>
        <button type="button" className="auth-secondary-link" onClick={() => setStep('welcome')}>← Volver</button>
      </form>
    </section></main>;
  }

  // Paso 2: consentimientos. Quedan registrados con fecha, versión y origen.
  if (step === 'terms') {
    return <main className="auth-page"><section className="login-card password-card onboarding-card">
      <span className="page-eyebrow">{isRenewal ? 'CONDICIONES ACTUALIZADAS' : 'PASO 2 DE 3'}</span>
      <h1>{isRenewal ? 'Revisa y acepta las condiciones vigentes' : 'Acepta las politicas internas'}</h1>
      <p>Todos los puntos son obligatorios para usar VITAHUB.</p>
      <div className="terms-list">
        {TERMS.map((term) => (
          <label key={term.key} className="terms-item">
            <input type="checkbox" checked={Boolean(accepted[term.key])} onChange={(e) => setAccepted({ ...accepted, [term.key]: e.target.checked })} />
            <span>{term.label}</span>
          </label>
        ))}
      </div>
      {termsError && <div className="alert alert-error">{termsError}</div>}
      {feedback && <div className="alert alert-error">{feedback}</div>}
      <button className="btn btn-primary btn-block" disabled={!allTermsAccepted || saving} onClick={async () => {
        if (!allTermsAccepted) { setTermsError('Debes aceptar todas las politicas para continuar.'); return; }
        if (!isRenewal) { setStep('password'); return; }
        // Renovación: se registra la aceptación y se vuelve al trabajo, sin más pasos.
        setSaving(true); setFeedback(null);
        try {
          await api.post('/auth/terms/accept', { acceptedConsents: TERMS.map((term) => term.key) });
          await refreshProfile();
          navigate(user?.role === 'client' ? '/portal' : '/dashboard', { replace: true });
        } catch (error) { setFeedback(error instanceof Error ? error.message : 'No se pudo registrar la aceptación.'); }
        finally { setSaving(false); }
      }}>{saving ? 'Registrando...' : isRenewal ? 'Aceptar y continuar trabajando' : 'Aceptar y continuar'}</button>
      {!isRenewal && <button type="button" className="auth-secondary-link" onClick={() => setStep('profile')}>← Volver</button>}
    </section></main>;
  }

  // Paso 3: contraseña propia. Al enviarlo se guarda todo junto.
  return <main className="auth-page"><section className="login-card password-card">
    <span className="page-eyebrow">PASO 3 DE 3</span><h1>Crea tu clave personal.</h1>
    <p>La contraseña temporal ya cumplio su funcion. Define una nueva segura para continuar.</p>
    <form onSubmit={submitOnboarding}>
      <PasswordField label="Contraseña temporal" value={form.currentPassword} onChange={(v) => setForm({ ...form, currentPassword: v })} required />
      <PasswordField label="Nueva contraseña" value={form.newPassword} onChange={(v) => setForm({ ...form, newPassword: v })} required showRules />
      <PasswordField label="Confirmar nueva contraseña" value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} required />
      {feedback && <div className="alert alert-error">{feedback}</div>}
      <button className="btn btn-primary btn-block" disabled={saving || !allRulesPassed}>{saving ? 'Protegiendo cuenta...' : 'Guardar y continuar'}</button>
      <button type="button" className="auth-secondary-link" onClick={() => setStep('terms')}>← Volver</button>
    </form>
  </section></main>;
}
