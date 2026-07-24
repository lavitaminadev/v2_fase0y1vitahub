/**
 * @fileoverview Accessible tooltip that wraps a trigger element.
 * Replaces the native `title=""` attribute used ad-hoc across the app —
 * `title` has inconsistent browser styling, a slow show delay, and does not
 * work on touch devices. This shows on hover, keyboard focus, and tap.
 */

import { useId, useRef, useState, type JSX, type ReactNode } from 'react';

/**
 * Props for the tooltip.
 */
export interface TooltipProps {
  /** Text shown in the tooltip bubble. */
  label: string;
  /** Element the tooltip is attached to. Must be a single focusable/hoverable element. */
  children: ReactNode;
  /** Which side of the trigger the bubble appears on. Defaults to 'top'. */
  side?: 'top' | 'bottom';
}

/**
 * Wraps `children` with an accessible tooltip, shown on hover, focus, or tap.
 */
export function Tooltip({ label, children, side = 'top' }: TooltipProps): JSX.Element {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();
  // Tap-to-show on touch devices auto-hides after a delay since there's no "un-hover".
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
