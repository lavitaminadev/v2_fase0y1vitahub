import { useState, type ReactNode } from 'react';

interface ExpandableDetailsProps {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function ExpandableDetails({ label, children, defaultOpen = false }: ExpandableDetailsProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="expandable-details">
      <button type="button" className="expandable-trigger" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="expandable-arrow">{open ? '▾' : '▸'}</span> {label}
      </button>
      {open && <div className="expandable-content">{children}</div>}
    </div>
  );
}
