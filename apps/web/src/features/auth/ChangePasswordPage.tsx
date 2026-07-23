import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';

const PASSWORD_RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: 'Al menos 8 caracteres', test: (v) => v.length >= 8 },
  { label: 'Al menos 1 mayuscula', test: (v) => /[A-Z]/.test(v) },
  { label: 'Al menos 1 minuscula', test: (v) => /[a-z]/.test(v) },
  { label: 'Al menos 1 numero', test: (v) => /\d/.test(v) },
];

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
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const allRulesPassed = useMemo(() => PASSWORD_RULES.every((r) => r.test(form.newPassword)), [form.newPassword]);
  const submit = async (event: React.FormEvent) => {
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
  return <main className="auth-page"><section className="login-card password-card">
    <span className="page-eyebrow">PRIMER INGRESO</span><h1>Crea tu clave personal.</h1>
    <p>La contraseña temporal ya cumplio su funcion. Define una nueva para continuar.</p>
    <form onSubmit={submit}>
      <PasswordField label="Contraseña temporal" value={form.currentPassword} onChange={(v) => setForm({ ...form, currentPassword: v })} required />
      <PasswordField label="Nueva contraseña" value={form.newPassword} onChange={(v) => setForm({ ...form, newPassword: v })} required showRules />
      <PasswordField label="Confirmar nueva contraseña" value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} required />
      {feedback && <div className="alert alert-error">{feedback}</div>}
      <button className="btn btn-primary btn-block" disabled={saving || !allRulesPassed}>{saving ? 'Protegiendo cuenta...' : 'Guardar y continuar'}</button>
      <Link to="/login" className="auth-secondary-link">← Volver al inicio de sesión</Link>
    </form>
  </section></main>;
}
