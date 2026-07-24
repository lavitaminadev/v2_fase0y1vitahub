/**
 * @fileoverview Focus trap for modal-like overlays (dialogs, drawers).
 * Extracted from Modal.tsx so every overlay gets the same accessible
 * behavior: focus moves into the panel on open, Tab/Shift+Tab stay inside
 * it, and focus returns to the trigger element on close.
 */

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab focus inside `containerRef` while `active` is true, and restores
 * focus to whatever was focused before activation once it becomes false.
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, active: boolean): void {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return undefined;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const frame = window.requestAnimationFrame(() => {
      const firstFocusable = containerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable ?? containerRef.current)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !containerRef.current) return;
      const focusable = Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        event.preventDefault();
        containerRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [active, containerRef]);
}
