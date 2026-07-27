import { Link } from 'react-router-dom';
import { useAuth } from '../../core/auth';
import { VitaminaPulse } from '../pulse/VitaminaPulse';

const PORTAL_CARDS = [
  {
    title: 'Mi parrilla',
    description: 'Contenido planificado y ventanas.',
    link: '/portal/grid',
    action: 'Ver parrilla',
  },
  {
    title: 'Aprobaciones',
    description: 'Aprueba o rechaza piezas pendientes.',
    link: '/portal/approvals',
    action: 'Revisar piezas',
  },
  {
    title: 'Reuniones',
    description: 'Próximos encuentros y enlaces.',
    link: '/portal/meetings',
    action: 'Ver reuniones',
  },
  {
    title: 'Mis informes',
    description: 'Resultados y métricas de performance.',
    link: '/portal/reports',
    action: 'Ver reportes',
  },
];

export function ClientDashboard() {
  const { user } = useAuth();

  return (
    <div className="page">
      <section className="portal-welcome"><span className="page-eyebrow">TU ESPACIO DE MARCA</span><h1>Bienvenido, {user?.name}</h1><p>Tu panel de avances y decisiones.</p><div className="portal-pulse"><span><i className="online-dot" />Cuenta activa</span><span>Actualizado hoy</span></div></section>
      <VitaminaPulse compact />

      <div className="card-grid">
        {PORTAL_CARDS.map((card) => (
          <div key={card.link} className="card portal-home-card">
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <Link to={card.link} className="btn btn-primary btn-sm">
              {card.action}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
