/**
 * @fileoverview Single toast/notification system for the whole app.
 *
 * There used to be two separate popup systems here: this file (generic
 * success/error/info messages fired by feature code via `triggerToast`) and
 * a second `ApiErrorToast` component that rendered API failures on its own,
 * independently positioned CustomEvent listener. They could stack on top of
 * each other with different styling. This file now owns both: it still
 * listens for `TOAST_EVENT` (manual `triggerToast` calls) and also listens
 * for `core/api.ts`'s `API_ERROR_EVENT` directly, rendering both through the
 * same list/positioning/dismiss logic.
 */

import { useEffect, useRef, useState } from 'react';
import { API_ERROR_EVENT, type ApiErrorEventDetail } from '../core/api';

export const TOAST_EVENT = 'vitahub-toast';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastDetail {
  message: string;
  kind?: 'success' | 'error' | 'info' | 'connection' | 'permission';
  /** Optional heading shown above the message (used by API error toasts). */
  title?: string;
  /** Optional action button, e.g. "Comprobar de nuevo" on connection errors. */
  action?: ToastAction;
}

interface ToastItem extends ToastDetail {
  id: number;
}

/** Fires a simple success/error/info toast from anywhere in the app. */
export function triggerToast(message: string, kind: ToastDetail['kind'] = 'success') {
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, kind } }));
}

// Connection issues stay visible longer since they usually require the user
// to notice, read, and act (e.g. check their network) rather than just glance.
function durationFor(kind: ToastDetail['kind']): number {
  if (kind === 'connection') return 10_000;
  if (kind === 'error' || kind === 'permission') return 7_000;
  return 4_000;
}

function iconFor(kind: ToastDetail['kind']): string {
  return kind === 'success' ? '✓' : '!';
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<number[]>([]);
  const mounted = useRef(true);
  const nextId = useRef(0);

  useEffect(() => {
    const dismiss = (id: number) => {
      if (mounted.current) setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    const push = (detail: ToastDetail) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, ...detail }]);
      timers.current.push(window.setTimeout(() => dismiss(id), durationFor(detail.kind)));
    };

    const handleToast = (event: Event) => push((event as CustomEvent<ToastDetail>).detail);

    const handleApiError = (event: Event) => {
      const detail = (event as CustomEvent<ApiErrorEventDetail>).detail;
      if (!detail?.message) return;
      const kind: ToastDetail['kind'] = detail.kind === 'connection' || detail.kind === 'permission' ? detail.kind : 'error';
      push({
        message: detail.message,
        title: detail.title,
        kind,
        action: detail.kind === 'connection' ? { label: 'Comprobar de nuevo', onClick: () => window.location.reload() } : undefined,
      });
    };

    window.addEventListener(TOAST_EVENT, handleToast);
    window.addEventListener(API_ERROR_EVENT, handleApiError);
    return () => {
      mounted.current = false;
      window.removeEventListener(TOAST_EVENT, handleToast);
      window.removeEventListener(API_ERROR_EVENT, handleApiError);
      timers.current.forEach((t) => clearTimeout(t));
      timers.current = [];
    };
  }, []);

  const close = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind ?? 'success'}`} role={t.kind === 'success' || t.kind === 'info' ? 'status' : 'alert'}>
          {t.title && <span className="toast-icon" aria-hidden="true">{iconFor(t.kind)}</span>}
          <div className="toast-body">
            {t.title && <strong className="toast-title">{t.title}</strong>}
            <span className="toast-message">{t.message}</span>
            {t.action && <button type="button" className="toast-action" onClick={t.action.onClick}>{t.action.label}</button>}
          </div>
          <button type="button" className="toast-close" onClick={() => close(t.id)} aria-label="Cerrar aviso">×</button>
        </div>
      ))}
    </div>
  );
}
