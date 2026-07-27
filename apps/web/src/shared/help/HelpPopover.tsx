import { useState, useEffect, useRef, type ReactNode } from 'react';

interface HelpPopoverProps {
  title: string;
  description?: string;
  formula?: string;
  source?: string;
  children?: ReactNode;
}

export function HelpPopover({ title, description, formula, source, children }: HelpPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <span className="help-popover-wrapper">
      <button type="button" className="help-icon-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`Ayuda: ${title}`}>ⓘ</button>
      {open && (
        <div className="help-popover" ref={ref} role="dialog" aria-label={title}>
          <strong className="help-popover-title">{title}</strong>
          {description && <p>{description}</p>}
          {formula && <div className="help-popover-formula"><span>Formula</span><code>{formula}</code></div>}
          {source && <small className="help-popover-source">Fuente: {source}</small>}
          {children}
        </div>
      )}
    </span>
  );
}
