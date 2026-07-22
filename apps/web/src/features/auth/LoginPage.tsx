import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth';
import { BrandLockup } from '../../shared/Brand';

const REMEMBERED_LOGIN_KEY = 'vitahub:remembered-login';

function getRememberedLogin(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(REMEMBERED_LOGIN_KEY) ?? '';
}

function getSessionHostWarning(): string | null {
  if (typeof window === 'undefined') return null;
  const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (!rawApiUrl || rawApiUrl.startsWith('/')) return null;
  try {
    const apiUrl = new URL(rawApiUrl);
    const webHost = window.location.hostname;
    if (apiUrl.hostname !== webHost) {
      return `Estás entrando por ${webHost}, pero la API local está configurada en ${apiUrl.hostname}. Para que la sesión no se cierre al recargar, usa http://${apiUrl.hostname}:5173 o alinea ambos en localhost.`;
    }
  } catch {
    return null;
  }
  return null;
}

export function LoginPage() {
  const rememberedLogin = useMemo(getRememberedLogin, []);
  const sessionHostWarning = useMemo(getSessionHostWarning, []);
  const [email, setEmail] = useState(rememberedLogin);
  const [password, setPassword] = useState('');
  const [rememberLogin, setRememberLogin] = useState(Boolean(rememberedLogin));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuth((s) => s.login);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Todos los campos son obligatorios');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      if (rememberLogin) {
        window.localStorage.setItem(REMEMBERED_LOGIN_KEY, email.trim().toLowerCase());
      } else {
        window.localStorage.removeItem(REMEMBERED_LOGIN_KEY);
      }
      const loggedInUser = useAuth.getState().user;
      navigate(loggedInUser?.mustChangePassword ? '/change-password' : loggedInUser?.role === 'client' ? '/portal' : '/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-story" aria-label="VITAHUB">
        <span className="login-eyebrow">NUESTRO NEGOCIO ES HACER CRECER EL TUYO</span>
        <h2>Todo el pulso de La Vitamina, en un solo lugar.</h2>
        <p>Clientes, producción, aprobaciones y resultados conectados desde el primer contacto hasta la entrega.</p>
        <div className="login-flow"><span>CRM</span><span>Producción</span><span>Resultados</span></div>
      </section>
      <form className="login-form" onSubmit={handleSubmit} autoComplete="on">
        <div className="login-brand"><BrandLockup /><span className="login-product">VITAHUB</span></div>
        <h1 className="login-title">Bienvenido de vuelta</h1>
        <p className="login-subtitle">Ingresa a tu espacio operativo</p>
        {sessionHostWarning && <div className="alert alert-warning login-session-warning">{sessionHostWarning}</div>}
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-group">
          <label htmlFor="email">Correo de acceso</label>
          <input
            id="email"
            name="username"
            className="input"
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            name="password"
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>
        <label className="login-remember">
          <input
            type="checkbox"
            checked={rememberLogin}
            onChange={(event) => setRememberLogin(event.target.checked)}
            disabled={loading}
          />
          <span>
            <strong>Recordar mi usuario en este equipo</strong>
            <small>La contraseña la guarda tu navegador o gestor de claves, no VitaHub.</small>
          </span>
        </label>
        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
        <Link className="auth-secondary-link" to="/forgot-password">¿Olvidaste tu contraseña?</Link>
      </form>
    </div>
  );
}
