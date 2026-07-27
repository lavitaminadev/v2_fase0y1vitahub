import { useState, useRef, useEffect, type ReactNode } from 'react';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface HelpTooltipProps {
  content: string;
  position?: TooltipPosition;
  children?: ReactNode;
  icon?: boolean;
}

export function HelpTooltip({ content, position = 'top', children, icon = true }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<number>(0);

  const show = () => { clearTimeout(timeoutRef.current); setOpen(true); };
  const hide = () => { timeoutRef.current = window.setTimeout(() => setOpen(false), 150); };

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return (
    <span className="help-tooltip-wrapper" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children ?? (icon ? <button type="button" className="help-icon-btn" aria-label="Ayuda" tabIndex={0} onClick={() => setOpen(!open)} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>ⓘ</button> : null)}
      {open && (
        <span className={`help-tooltip help-tooltip-${position}`} role="tooltip" ref={triggerRef}>
          {content}
        </span>
      )}
    </span>
  );
}
