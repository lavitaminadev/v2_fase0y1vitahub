import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getHelpForModule, type HelpSection } from './helpContent';

function guessModule(pathname: string): string {
  if (pathname.includes('/dashboard')) return 'dashboard';
  if (pathname.includes('/crm') || pathname.includes('/leads')) return 'crm';
  if (pathname.includes('/integrations')) return 'integrations';
  if (pathname.includes('/production')) return 'production';
  if (pathname.includes('/reservations')) return 'reservations';
  if (pathname.includes('/settings')) return 'settings';
  return 'dashboard';
}

function SectionItem({ section }: { section: HelpSection }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="help-section">
      <button type="button" className="help-section-trigger" onClick={() => setOpen(!open)} aria-expanded={open}>
        {section.title}
        <span className="expandable-arrow">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="help-section-body">
          {section.description && <p>{section.description}</p>}
          {section.items?.map((item) => (
            <div key={item.id} className="help-section-item">
              <strong>{item.label}</strong>
              <small>{item.description}</small>
              {item.formula && <code>{item.formula}</code>}
              {item.source && <span className="help-item-source">Fuente: {item.source}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ContextHelpDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ContextHelpDrawer({ open, onClose }: ContextHelpDrawerProps) {
  const location = useLocation();
  const module = guessModule(location.pathname);
  const help = getHelpForModule(module);

  useEffect(() => {
    if (open) {
      const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      document.addEventListener('keydown', esc);
      document.body.style.overflow = 'hidden';
      return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="help-drawer-backdrop" onClick={onClose} />
      <aside className="help-drawer" role="dialog" aria-label={`Ayuda: ${help.title}`}>
        <header className="help-drawer-header">
          <div><span className="page-eyebrow">AYUDA CONTEXTUAL</span><h2>{help.title}</h2></div>
          <button onClick={onClose} aria-label="Cerrar ayuda">✕</button>
        </header>
        <p className="help-drawer-desc">{help.description}</p>
        <div className="help-drawer-body">
          {help.sections.map((section) => <SectionItem key={section.id} section={section} />)}
        </div>
      </aside>
    </>
  );
}
