/**
 * @fileoverview Tooltip accesible que envuelve un elemento disparador.
 * Reemplaza el atributo nativo `title=""` usado ad-hoc en toda la app —
 * `title` tiene estilos inconsistentes entre navegadores, un delay de
 * aparición lento, y no funciona en dispositivos táctiles. Este se muestra
 * en hover, focus de teclado y tap.
 */

import { useId, useRef, useState, type JSX, type ReactNode } from 'react';

/**
 * Props del tooltip.
 */
export interface TooltipProps {
  /** Texto mostrado en la burbuja del tooltip. */
  label: string;
  /** Elemento al que se adjunta el tooltip. Debe ser un único elemento focuseable/con hover. */
  children: ReactNode;
  /** De qué lado del disparador aparece la burbuja. Por defecto, 'top'. */
  side?: 'top' | 'bottom';
}

/**
 * Envuelve `children` con un tooltip accesible, mostrado en hover, focus o tap.
 */
export function Tooltip({ label, children, side = 'top' }: TooltipProps): JSX.Element {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();
  // En dispositivos táctiles, tap-to-show se auto-oculta tras un delay ya que no existe "un-hover".
  const hideTimer = useRef<number | undefined>(undefined);

  const show = () => {
    window.clearTimeout(hideTimer.current);
    setVisible(true);
  };
  const hide = () => setVisible(false);
  const showFromTap = () => {
    show();
    hideTimer.current = window.setTimeout(hide, 2500);
  };

  return (
    <span
      className="tooltip-anchor"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onTouchStart={showFromTap}
      aria-describedby={visible ? tooltipId : undefined}
    >
      {children}
      {visible && (
        <span role="tooltip" id={tooltipId} className={`tooltip-bubble tooltip-${side}`}>
          {label}
        </span>
      )}
    </span>
  );
}
