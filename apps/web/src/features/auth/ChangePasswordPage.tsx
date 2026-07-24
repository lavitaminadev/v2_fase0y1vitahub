import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [step, setStep] = useState<'welcome' | 'terms' | 'password'>('welcome');
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [termsError, setTermsError] = useState('');
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const allRulesPassed = useMemo(() => PASSWORD_RULES.every((r) => r.test(form.newPassword)), [form.newPassword]);
  const allTermsAccepted = TERMS.every((t) => accepted[t.key]);

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.newPassword !== form.confirm) { setFeedback('Las contraseñas nuevas no coinciden.'); return; }
    if (!allRulesPassed) { setFeedback('La nueva contraseña no cumple los requisitos minimos de seguridad.'); return; }
    setSaving(true); setFeedback(null);
    try {
      await api.put('/auth/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      await refreshProfile();
      navigate('/dashboard', { replace: true });
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.'); }
    finally { setSaving(false); }
  };

  // Step 1: Welcome
  if (step === 'welcome') {
    return <main className="auth-page"><section className="login-card password-card onboarding-card">
      <span className="page-eyebrow">BIENVENIDO{user?.name ? `, ${user.name.split(' ')[0].toUpperCase()}` : ''}</span>
      <h1>¿Es tu primera vez aca?</h1>
      <p>Revisa y acepta las políticas internas.</p>
      <div className="onboarding-features">
        <div><span>🔒</span><strong>Confidencialidad</strong><small>Información de clientes protegida.</small></div>
        <div><span>📋</span><strong>Terminos claros</strong><small>Reglas simples para el buen uso de la plataforma.</small></div>
        <div><span>🛡</span><strong>Datos protegidos</strong><small>Cumplimos con la normativa de proteccion de datos.</small></div>
      </div>
      <button className="btn btn-primary btn-block" onClick={() => setStep('terms')}>Comenzar</button>
      <button type="button" className="auth-secondary-link" onClick={async () => { await useAuth.getState().logout(); navigate('/login', { replace: true }); }}>← Volver al inicio de sesion</button>
    </section></main>;
  }

  // Step 2: Terms acceptance
  if (step === 'terms') {
    return <main className="auth-page"><section className="login-card password-card onboarding-card">
      <span className="page-eyebrow">PASO 1 DE 2</span>
      <h1>Acepta las politicas internas</h1>
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
      <button className="btn btn-primary btn-block" disabled={!allTermsAccepted} onClick={() => { if (!allTermsAccepted) { setTermsError('Debes aceptar todas las politicas para continuar.'); return; } setStep('password'); }}>Aceptar y continuar</button>
      <button type="button" className="auth-secondary-link" onClick={() => setStep('welcome')}>← Volver</button>
    </section></main>;
  }

  // Step 3: Password change
  return <main className="auth-page"><section className="login-card password-card">
    <span className="page-eyebrow">PASO 2 DE 2</span><h1>Crea tu clave personal.</h1>
    <p>La contraseña temporal ya cumplio su funcion. Define una nueva segura para continuar.</p>
    <form onSubmit={submitPassword}>
      <PasswordField label="Contraseña temporal" value={form.currentPassword} onChange={(v) => setForm({ ...form, currentPassword: v })} required />
      <PasswordField label="Nueva contraseña" value={form.newPassword} onChange={(v) => setForm({ ...form, newPassword: v })} required showRules />
      <PasswordField label="Confirmar nueva contraseña" value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} required />
      {feedback && <div className="alert alert-error">{feedback}</div>}
      <button className="btn btn-primary btn-block" disabled={saving || !allRulesPassed}>{saving ? 'Protegiendo cuenta...' : 'Guardar y continuar'}</button>
      <button type="button" className="auth-secondary-link" onClick={() => setStep('terms')}>← Volver</button>
    </form>
  </section></main>;
}
