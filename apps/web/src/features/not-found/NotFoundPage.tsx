import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="page" style={{ textAlign: 'center', paddingTop: '4rem' }}>
      <h1>404 — Página no encontrada</h1>
      <p style={{ color: '#666' }}>La página que buscas no existe.</p>
      <Link to="/dashboard" className="btn btn-primary">Ir al Dashboard</Link>
    </div>
  );
}
