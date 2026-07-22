import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const refreshProfile = useAuth((state) => state.refreshProfile);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.newPassword !== form.confirm) { setFeedback('Las contraseñas nuevas no coinciden.'); return; }
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
    <p>La contraseña temporal ya cumplió su función. Define una nueva para continuar.</p>
    <form onSubmit={submit}>
      <label>Contraseña temporal<input className="input" type="password" required minLength={8} value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} /></label>
      <label>Nueva contraseña<input className="input" type="password" required minLength={8} value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} /></label>
      <label>Confirmar nueva contraseña<input className="input" type="password" required minLength={8} value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} /></label>
      {feedback && <div className="alert alert-error">{feedback}</div>}
      <button className="btn btn-primary btn-block" disabled={saving}>{saving ? 'Protegiendo cuenta...' : 'Guardar y continuar'}</button>
    </form>
  </section></main>;
}
