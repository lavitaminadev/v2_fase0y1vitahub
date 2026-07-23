import { useEffect, useRef, useState } from 'react';

export const TOAST_EVENT = 'vitahub-toast';
export interface ToastDetail { message: string; kind?: 'success' | 'error' | 'info' }

export function triggerToast(message: string, kind: 'success' | 'error' | 'info' = 'success') {
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, kind } }));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; kind: string }>>([]);
  const timers = useRef<number[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    let nextId = 0;
    const handler = (event: Event) => {
      const { message, kind = 'success' } = (event as CustomEvent<ToastDetail>).detail;
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, kind }]);
      const timer = window.setTimeout(() => {
        if (mounted.current) setToasts((prev) => prev.filter((t) => t.id !== id));
      }, kind === 'error' ? 7000 : 4000);
      timers.current.push(timer);
    };
    window.addEventListener(TOAST_EVENT, handler);
    return () => {
      mounted.current = false;
      window.removeEventListener(TOAST_EVENT, handler);
      timers.current.forEach((t) => clearTimeout(t));
      timers.current = [];
    };
  }, []);

  return <div className="toast-container">{toasts.map((t) => <div key={t.id} className={`toast toast-${t.kind}`} role="status"><span>{t.message}</span></div>)}</div>;
}
