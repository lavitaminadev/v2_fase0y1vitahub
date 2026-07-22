import { NavLink } from 'react-router-dom';

const ITEMS = [
  { to: '/crm/contacts', label: 'Contactos', description: 'Personas de reservas' },
];

export function CrmNav() {
  return (
    <nav className="crm-section-nav" aria-label="Secciones del CRM">
      {ITEMS.map((item, index) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => isActive ? 'active' : ''}>
          <span>0{index + 1}</span><strong>{item.label}</strong><small>{item.description}</small>
        </NavLink>
      ))}
    </nav>
  );
}
