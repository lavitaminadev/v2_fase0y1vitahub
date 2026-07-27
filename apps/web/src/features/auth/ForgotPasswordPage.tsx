import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../core/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('sending');
    try {
      await api.post('/auth/password/request-reset', { email: email.trim().toLowerCase() });
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  return <main className="auth-page"><section className="login-card password-card">
    <span className="page-eyebrow">RECUPERAR ACCESO</span><h1>Volvamos a conectarte.</h1>
    <p>Ingresa el correo de tu cuenta. Si está activo, recibirás un enlace válido por 30 minutos.</p>
    {status === 'sent' ? <div className="alert alert-success">Solicitud recibida. Revisa tu correo y la carpeta de spam.</div> : <form onSubmit={submit}>
      <label>Correo de acceso<input className="input" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      {status === 'error' && <div className="alert alert-error">No pudimos procesar la solicitud. Intenta nuevamente.</div>}
      <button className="btn btn-primary btn-block" disabled={status === 'sending'}>{status === 'sending' ? 'Enviando...' : 'Enviar enlace seguro'}</button>
    </form>}
    <Link className="auth-secondary-link" to="/login">Volver al inicio de sesión</Link>
  </section></main>;
}
