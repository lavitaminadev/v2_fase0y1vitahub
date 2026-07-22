import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../core/auth';
import { NavGlyph } from '../../shared/NavGlyph';
import { BrandMark } from '../../shared/Brand';
import { NotificationBell } from '../notifications/NotificationBell';
import { PwaInstallButton } from '../../shared/PwaInstallButton';

const CLIENT_NAV = [
  { label: 'Inicio', path: '/portal', icon: 'IN' },
  { label: 'Reservas', path: '/portal/reservations', icon: 'RS' },
];

export function ClientLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  return (
    <div className="app-layout">
      <button className="sidebar-toggle" onClick={() => setOpen(!open)} aria-label="Abrir navegación" aria-expanded={open}>☰</button>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header"><BrandMark decorative /><div><h2>Mi cuenta</h2><span>La Vitamina</span></div></div>
        <nav className="sidebar-nav">
          {CLIENT_NAV.map((item) => {
            const active = location.pathname === item.path || (item.path !== '/portal' && location.pathname.startsWith(`${item.path}/`));
            return (
              <Link key={item.path} to={item.path} className={`nav-item ${active ? 'active' : ''}`} onClick={() => setOpen(false)}>
                <NavGlyph label={item.label} />
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-footer-actions"><NotificationBell /></div>
          <PwaInstallButton />
          <div className="user-info"><div className="user-name">{user?.name}</div><div className="user-role">Cliente</div></div>
          <Link className="sidebar-account-link" to="/change-password" onClick={() => setOpen(false)}>Cambiar mi contraseña</Link>
          <button className="btn btn-outline btn-sm" onClick={logout}>Cerrar sesión</button>
        </div>
      </aside>
      {open && <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Cerrar navegacion" />}
      <div className="app-workspace client-workspace"><header className="workspace-header"><div className="workspace-heading"><span>Portal cliente</span><strong>Tu marca, en un solo lugar</strong></div></header><main className="main-content"><Outlet /></main></div>
    </div>
  );
}
