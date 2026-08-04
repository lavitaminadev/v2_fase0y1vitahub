/**
 * @fileoverview Layout de la aplicación con sidebar responsivo y navegación
 * basada en roles.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../core/auth';
import { getNavigation, getNavigationSections } from '../core/navigation.registry';
import { NavGlyph } from './NavGlyph';
import { ToastContainer } from './Toast';
import { NotificationCenter } from './NotificationCenter';
import { BrandMark } from './Brand';
import { CommandPalette } from './CommandPalette';
import { PwaInstallButton } from './PwaInstallButton';
import { NotificationBell } from '../features/notifications/NotificationBell';
import { ContextHelpDrawer } from './help/ContextHelpDrawer';
import { useFocusTrap } from './useFocusTrap';

/**
 * Breakpoint en el que el sidebar pasa de fijo (desktop) a drawer superpuesto
 * (móvil). Debe coincidir con el `max-width: 768px` de `styles/direction.css`,
 * que es lo que efectivamente decide el layout visual.
 */
const MOBILE_BREAKPOINT_QUERY = '(max-width: 768px)';

/**
 * Secciones del menú lateral.
 *
 * Cada grupo responde a una pregunta distinta de quien lo usa, y el orden va de lo más
 * frecuente a lo más ocasional. Una ruta que no figure en ningún grupo no se muestra, así
 * que al registrar una feature nueva hay que agregarla acá.
 *
 * La separación entre los dos CRM es deliberada: «Contactos de campañas» pertenece a la
 * operación de las cuentas de clientes, mientras el pipeline es de la propia agencia.
 */
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches);
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => { const updateConnection = () => setOnline(navigator.onLine); window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection); return () => { window.removeEventListener('online', updateConnection); window.removeEventListener('offline', updateConnection); }; }, []);
  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const updateIsMobile = () => setIsMobile(mediaQuery.matches);
    updateIsMobile();
    mediaQuery.addEventListener('change', updateIsMobile);
    return () => mediaQuery.removeEventListener('change', updateIsMobile);
  }, []);

  // El sidebar es un drawer solo en móvil: ahí necesita comportarse como el
  // Modal (foco atrapado, Escape cierra, scroll del body bloqueado). En
  // desktop es fijo y siempre visible, así que este trap nunca debe activarse
  // aunque `sidebarOpen` quede en true de una sesión móvil previa.
  const sidebarTrapActive = sidebarOpen && isMobile;
  useFocusTrap(sidebarRef, sidebarTrapActive);
  useEffect(() => {
    if (!sidebarTrapActive) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSidebarOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [sidebarTrapActive]);

  // Calcula la navegación una vez por cambio de rol para evitar filtrar en cada render.
  const navItems = useMemo(() => getNavigation(user?.role, user?.features, user?.permissions), [user?.role, user?.features, user?.permissions]);
  // Las secciones viven en el registro junto al orden del sidebar: mantenerlas acá hacía
  // que una ruta no listada desapareciera del menú sin aviso.
  const groupedNavItems = useMemo(
    () => getNavigationSections(user?.role, user?.features, user?.permissions),
    [user?.role, user?.features, user?.permissions],
  );

  const toggleSidebar = useCallback(() => setSidebarOpen((open) => !open), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const currentItem = navItems.find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));

  return (
    <div className="app-layout">
      <ToastContainer />
      <NotificationCenter />
      <CommandPalette />
      {!online && <div className="offline-banner" role="alert"><strong>Sin conexión</strong><span>Puedes revisar la pantalla actual, pero los cambios no se enviarán hasta recuperar internet.</span></div>}
      <button className="sidebar-toggle" onClick={toggleSidebar} aria-label="Abrir navegación" aria-expanded={sidebarOpen}>
        ☰
      </button>
      <aside ref={sidebarRef} className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
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
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
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
          <div className="workspace-heading" aria-label="Vista actual">
            <span>Espacio de trabajo</span>
            <strong>{currentItem?.label ?? 'VITAHUB'}</strong>
          </div>
          <div className="workspace-header-actions">
            <button
              type="button"
              className="workspace-command workspace-search"
              onClick={() => window.dispatchEvent(new Event('vitahub:open-command'))}
              aria-label="Buscar o ejecutar una acción"
            >
              <span aria-hidden="true">🔍</span>
              <span>Buscar o ejecutar</span>
              <kbd>Ctrl K</kbd>
            </button>
            <button
              type="button"
              className="workspace-command"
              style={{ minWidth: 0, padding: '7px 9px' }}
              onClick={() => setHelpOpen(true)}
              aria-label="Abrir ayuda"
              title="Ayuda"
            >
              <span aria-hidden="true">?</span>
            </button>
            <div className="workspace-user" aria-label={`Sesión de ${user?.name ?? 'usuario'}`}>
              <span className="online-dot" aria-hidden="true" />
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--nav-active-bg)',
                  color: 'var(--nav-active-text)',
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {(user?.name ?? 'U').trim().charAt(0).toUpperCase()}
              </span>
              <span>{user?.name}</span>
            </div>
          </div>
        </header>
        <main className="main-content"><Outlet /></main>
        <ContextHelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
      </div>
    </div>
  );
}
