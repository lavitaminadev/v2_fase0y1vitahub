/**
 * @fileoverview Layout de la aplicación con sidebar responsivo y navegación
 * basada en roles.
 */

import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../core/auth';
import { getNavigation } from '../core/navigation.registry';
import { NavGlyph } from './NavGlyph';
import { ToastContainer } from './Toast';
import { NotificationCenter } from './NotificationCenter';
import { BrandMark } from './Brand';
import { CommandPalette } from './CommandPalette';
import { PwaInstallButton } from './PwaInstallButton';
import { NotificationBell } from '../features/notifications/NotificationBell';
import { ContextHelpDrawer } from './help/ContextHelpDrawer';
import { GlobalSearch } from './GlobalSearch';

const NAV_GROUPS: { label: string; paths: string[] }[] = [
  { label: 'Fase 1 reservas', paths: ['/dashboard', '/reservations', '/reservations/calendar', '/reservations/availability', '/crm/contacts', '/clients'] },
  { label: 'Comercial La Vitamina', paths: ['/crm/leads', '/crm/opportunities', '/crm/interactions'] },
  { label: 'Meta e integraciones', paths: ['/integrations/meta/events', '/integrations'] },
  { label: 'Administracion', paths: ['/system/health', '/users', '/settings'] },
];

/**
 * Shell de layout principal renderizado para usuarios autenticados.
 *
 * Responsabilidades:
 * - Renderizar el sidebar responsivo.
 * - Filtrar la navegación según el rol del usuario.
 * - Proveer un outlet para las rutas anidadas.
 */
export function Layout(): JSX.Element {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useState(() => window.localStorage.getItem('vitahub:sidebar:compact') === 'true');
  const [helpOpen, setHelpOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => { const updateConnection = () => setOnline(navigator.onLine); window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection); return () => { window.removeEventListener('online', updateConnection); window.removeEventListener('offline', updateConnection); }; }, []);

  // Calcula la navegación una vez por cambio de rol para evitar filtrar en cada render.
  const navItems = useMemo(() => getNavigation(user?.role, user?.features, user?.permissions), [user?.role, user?.features, user?.permissions]);
  const groupedNavItems = useMemo(
    () => NAV_GROUPS.map((group) => ({
      ...group,
      items: group.paths.flatMap((path) => navItems.find((item) => item.path === path) ?? []),
    })).filter((group) => group.items.length > 0),
    [navItems],
  );

  const toggleSidebar = useCallback(() => setSidebarOpen((open) => !open), []);
  const toggleSidebarCompact = useCallback(() => {
    setSidebarCompact((current) => {
      const next = !current;
      window.localStorage.setItem('vitahub:sidebar:compact', String(next));
      return next;
    });
  }, []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const matchesNavItem = useCallback((path: string) => location.pathname === path || (path !== '/integrations' && location.pathname.startsWith(`${path}/`)), [location.pathname]);
  const currentItem = navItems.find((item) => matchesNavItem(item.path));

  return (
    <div className={`app-layout ${sidebarCompact ? 'sidebar-compact' : ''}`}>
      <ToastContainer />
      <NotificationCenter />
      <CommandPalette />
      {!online && <div className="offline-banner" role="alert"><strong>Sin conexión</strong><span>Puedes revisar la pantalla actual, pero los cambios no se enviarán hasta recuperar internet.</span></div>}
      <button className="sidebar-toggle" onClick={toggleSidebar} aria-label="Abrir navegación" aria-expanded={sidebarOpen}>
        ☰
      </button>
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <BrandMark decorative />
          <div><h2>VITAHUB</h2><span>La Vitamina</span></div>
          <button type="button" className="sidebar-collapse-button" onClick={toggleSidebarCompact} aria-label={sidebarCompact ? 'Expandir menu' : 'Achicar menu'} title={sidebarCompact ? 'Expandir menu' : 'Achicar menu'}>
            {sidebarCompact ? '>' : '<'}
          </button>
        </div>
        <nav className="sidebar-nav">
          {groupedNavItems.map((group) => (
            <section className="sidebar-nav-section" key={group.label} aria-label={group.label}>
              <span className="sidebar-nav-section-title">{group.label}</span>
              {group.items.map((item) => {
                const active = matchesNavItem(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`nav-item ${active ? 'active' : ''}`}
                    onClick={closeSidebar}
                    aria-label={item.label}
                    title={item.label}
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
      {sidebarOpen && <button className="sidebar-backdrop" onClick={closeSidebar} aria-label="Cerrar navegación" />}
      <div className="app-workspace">
        <header className="workspace-header">
          <div className="workspace-heading"><span>Espacio de trabajo</span><strong>{currentItem?.label ?? 'VITAHUB'}</strong></div>
          <div className="workspace-header-actions"><GlobalSearch /><button className="workspace-command" onClick={() => setHelpOpen(true)} title="Ayuda"><span>? Ayuda</span></button><button className="workspace-command" onClick={() => window.dispatchEvent(new Event('vitahub:open-command'))}><span>Comandos</span><kbd>Ctrl K</kbd></button><div className="workspace-user"><span className="online-dot" />{user?.name}</div></div>
        </header>
        <main className="main-content"><Outlet /></main>
        <ContextHelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
      </div>
    </div>
  );
}
