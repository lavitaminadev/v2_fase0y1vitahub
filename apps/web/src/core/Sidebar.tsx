import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';
import { VitaIcons } from '../shared/Icons';

interface NavItem {
  path: string;
  label: string;
  icon: any;
  badge?: number;
  submenu?: NavItem[];
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: VitaIcons.home },
  {
    path: '/reservations',
    label: 'Reservas',
    icon: VitaIcons.calendar,
    submenu: [
      { path: '/reservations?tab=forms', label: 'Formularios', icon: VitaIcons.list },
      { path: '/reservations?tab=bookings', label: 'Bandeja', icon: VitaIcons.inbox },
      { path: '/reservations?tab=metrics', label: 'Métricas', icon: VitaIcons.chart },
    ],
  },
  { path: '/crm', label: 'CRM', icon: VitaIcons.users },
  { path: '/clients', label: 'Clientes', icon: VitaIcons.building },
  { path: '/settings', label: 'Configuración', icon: VitaIcons.cog },
];

export function Sidebar() {
  const [expanded, setExpanded] = useState(true);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const location = useLocation();

  return (
    <>
      <aside className={`sidebar ${expanded ? 'expanded' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="logo">{expanded && <span>VITAHUB</span>}</div>
          <button className="toggle-btn" onClick={() => setExpanded(!expanded)} title={expanded ? 'Contraer' : 'Expandir'}>
            {expanded ? '◀' : '▶'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <div key={item.path}>
              {item.submenu ? (
                <button
                  className={`nav-item ${openSubmenu === item.path ? 'active' : ''}`}
                  onClick={() => setOpenSubmenu(openSubmenu === item.path ? null : item.path)}
                >
                  <item.icon className="nav-icon" />
                  {expanded && (
                    <>
                      <span className="nav-label">{item.label}</span>
                      <span className="submenu-toggle">{openSubmenu === item.path ? '▼' : '▶'}</span>
                    </>
                  )}
                </button>
              ) : (
                <Link
                  to={item.path}
                  className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                >
                  <item.icon className="nav-icon" />
                  {expanded && <span className="nav-label">{item.label}</span>}
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </Link>
              )}

              {item.submenu && openSubmenu === item.path && expanded && (
                <div className="submenu">
                  {item.submenu.map(sub => (
                    <Link
                      key={sub.path}
                      to={sub.path}
                      className={`submenu-item ${location.pathname === sub.path || location.search.includes(sub.path.split('?')[1]) ? 'active' : ''}`}
                    >
                      <sub.icon className="submenu-icon" />
                      {sub.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {expanded && <div className="sidebar-overlay" onClick={() => setExpanded(false)} />}
    </>
  );
}
