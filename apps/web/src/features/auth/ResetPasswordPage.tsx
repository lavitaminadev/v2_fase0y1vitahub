import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../core/api';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) { setFeedback('Las contraseñas no coinciden.'); return; }
    setSaving(true); setFeedback(null);
    try { await api.post('/auth/password/reset', { token, password }); setComplete(true); }
    catch (error) { setFeedback(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.'); }
    finally { setSaving(false); }
  };

  return <main className="auth-page"><section className="login-card password-card">
    <span className="page-eyebrow">NUEVA CONTRASEÑA</span><h1>Protege tu cuenta.</h1>
    {!token ? <div className="alert alert-error">El enlace está incompleto.</div> : complete ? <div className="alert alert-success">Contraseña actualizada. Ya puedes iniciar sesión.</div> : <form onSubmit={submit}>
      <label>Nueva contraseña<input className="input" type="password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <label>Confirmar contraseña<input className="input" type="password" minLength={8} maxLength={128} required value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>
      {feedback && <div className="alert alert-error">{feedback}</div>}
      <button className="btn btn-primary btn-block" disabled={saving}>{saving ? 'Guardando...' : 'Cambiar contraseña'}</button>
    </form>}
    <Link className="auth-secondary-link" to="/login">Ir al inicio de sesión</Link>
  </section></main>;
}
