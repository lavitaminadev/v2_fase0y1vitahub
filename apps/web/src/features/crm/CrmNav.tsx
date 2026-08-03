import { useAuth } from '../../core/auth';
import { NavLink } from 'react-router-dom';

const OPERATION_ITEMS = [
  { to: '/crm/contacts', label: 'Comensales y contactos', description: 'Restaurante -> comensal' },
];

const COMMERCIAL_ITEMS = [
  { to: '/crm/leads', label: 'Prospectos de agencia', description: 'La Vitamina -> prospecto' },
  { to: '/crm/opportunities', label: 'Pipeline comercial', description: 'Negocios, propuesta y cierre' },
  { to: '/crm/interactions', label: 'Actividad comercial', description: 'Seguimientos, correos y reuniones' },
];

export function CrmNav() {
  const user = useAuth((state) => state.user);
  const showCommercial = user?.role === 'admin' || user?.role === 'commercial_director';

  return (
    <nav className="crm-section-nav" aria-label="Secciones del CRM">
      {OPERATION_ITEMS.map((item, index) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => isActive ? 'active' : ''}>
          <span>0{index + 1}</span><strong>{item.label}</strong><small>{item.description}</small>
        </NavLink>
      ))}
      {showCommercial && COMMERCIAL_ITEMS.map((item, index) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => isActive ? 'active' : ''}>
          <span>0{index + OPERATION_ITEMS.length + 1}</span><strong>{item.label}</strong><small>{item.description}</small>
        </NavLink>
      ))}
    </nav>
  );
}
