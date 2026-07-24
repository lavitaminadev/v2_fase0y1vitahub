/**
 * @fileoverview Accessible modal dialog with Escape-to-close and backdrop click.
 */

import { useEffect, useId, useRef, type JSX, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from './useFocusTrap';

/**
 * Props for the modal component.
 */
export interface ModalProps {
  /** Whether the modal is visible. */
  open: boolean;
  /** Callback invoked when the modal should close. */
  onClose: () => void;
  /** Modal title shown in the header. */
  title: string;
  /** Modal body content. */
  children: ReactNode;
}

/**
 * Renders a modal overlay.
 */
export function Modal({ open, onClose, title, children }: ModalProps): JSX.Element | null {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  onCloseRef.current = onClose;

  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="modal-content" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="modal-header">
          <h3 id={titleId}>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar modal" type="button">
            x
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
