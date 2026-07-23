/**
 * @fileoverview Application layout with responsive sidebar and role-based
 * navigation.
 */

import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../core/auth';
import { getNavigation } from '../core/navigation.registry';
import { NotificationBell } from '../features/notifications/NotificationBell';
import { NavGlyph } from './NavGlyph';
import { ApiErrorToast } from './ApiErrorToast';
import { ToastContainer } from './Toast';
import { BrandMark } from './Brand';
import { CommandPalette } from './CommandPalette';
import { PwaInstallButton } from './PwaInstallButton';

const NAV_GROUPS = [
  { label: 'Medir', paths: ['/dashboard'] },
  { label: 'Operar', paths: ['/reservations', '/crm/contacts'] },
  { label: 'Configurar', paths: ['/clients', '/users', '/integrations', '/settings'] },
] as const;

/**
 * Main layout shell rendered for authenticated users.
 *
 * Responsibilities:
 * - Render responsive sidebar.
 * - Filter navigation by user role.
 * - Provide an outlet for nested routes.
 */
export function Layout(): JSX.Element {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => { const updateConnection = () => setOnline(navigator.onLine); window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection); return () => { window.removeEventListener('online', updateConnection); window.removeEventListener('offline', updateConnection); }; }, []);

  // Compute navigation once per role change to avoid filtering on every render.
  const navItems = useMemo(() => getNavigation(user?.role), [user?.role]);
  const groupedNavItems = useMemo(
    () => NAV_GROUPS.map((group) => ({
      ...group,
      items: group.paths.flatMap((path) => navItems.find((item) => item.path === path) ?? []),
    })).filter((group) => group.items.length > 0),
    [navItems],
  );

  const toggleSidebar = useCallback(() => setSidebarOpen((open) => !open), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const currentItem = navItems.find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));

  return (
    <div className="app-layout">
      <ApiErrorToast />
      <ToastContainer />
      <CommandPalette />
      {!online && <div className="offline-banner" role="alert"><strong>Sin conexión</strong><span>Puedes revisar la pantalla actual, pero los cambios no se enviarán hasta recuperar internet.</span></div>}
      <button className="sidebar-toggle" onClick={toggleSidebar} aria-label="Abrir navegación" aria-expanded={sidebarOpen}>
        ☰
      </button>
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <BrandMark decorative />
          <div><h2>VITAHUB</h2><span>La Vitamina</span></div>
        </div>
        <nav className="sidebar-nav">
          {groupedNavItems.map((group) => (
            <section className="sidebar-nav-section" key={group.label} aria-label={group.label}>
              <span className="sidebar-nav-section-title">{group.label}</span>
              {group.items.map((item) => {
                const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`nav-item ${active ? 'active' : ''}`}
                    onClick={closeSidebar}
                  >
                    <NavGlyph label={item.label} />
                    <span className="nav-label">{item.label}</span>
                  </Link>
                );
              })}
            </section>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-footer-actions">
            <NotificationBell />
          </div>
          <PwaInstallButton />
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role}</div>
          </div>
          <Link className="sidebar-account-link" to="/change-password" onClick={closeSidebar}>Cambiar mi contraseña</Link>
          <button className="btn btn-outline btn-sm" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      {sidebarOpen && <button className="sidebar-backdrop" onClick={closeSidebar} aria-label="Cerrar navegacion" />}
      <div className="app-workspace">
        <header className="workspace-header">
          <div className="workspace-heading"><span>Espacio de trabajo</span><strong>{currentItem?.label ?? 'VITAHUB'}</strong></div>
          <div className="workspace-header-actions"><button className="workspace-command" onClick={() => window.dispatchEvent(new Event('vitahub:open-command'))}><span>Buscar o ejecutar</span><kbd>Ctrl K</kbd></button><div className="workspace-user"><span className="online-dot" />{user?.name}</div></div>
        </header>
        <main className="main-content"><Outlet /></main>
      </div>
    </div>
  );
}
