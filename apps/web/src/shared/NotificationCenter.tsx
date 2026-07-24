import { useEffect, useRef, useState } from 'react';
import './NotificationCenter.css';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  title?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const NOTIFICATION_EVENT = 'vitahub-notification';

export interface NotificationDetail {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  title?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Dispara una notificación desde cualquier parte de la app.
 * Alternativa más simple al Toast para casos que necesitan duración automática configurable.
 */
export function notify(
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
  duration = 4000,
) {
  window.dispatchEvent(
    new CustomEvent<NotificationDetail>(NOTIFICATION_EVENT, {
      detail: { message, type, duration },
    }),
  );
}

/**
 * Dispara una notificación con más opciones (título, acción, etc).
 */
export function notifyAdvanced(detail: NotificationDetail) {
  window.dispatchEvent(
    new CustomEvent<NotificationDetail>(NOTIFICATION_EVENT, { detail }),
  );
}

function durationFor(type: NotificationDetail['type']): number {
  if (type === 'error') return 6000;
  if (type === 'warning') return 5000;
  return 3500;
}

function iconFor(type: NotificationDetail['type']): string {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '!';
    case 'warning':
      return '⚠';
    case 'info':
      return 'ℹ';
  }
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timers = useRef<number[]>([]);
  const mounted = useRef(true);
  const nextId = useRef(0);

  useEffect(() => {
    const dismiss = (id: string) => {
      if (mounted.current) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }
    };

    const push = (detail: NotificationDetail) => {
      const id = String(nextId.current++);
      setNotifications((prev) => [...prev, { id, ...detail }]);

      const duration = detail.duration ?? durationFor(detail.type);
      if (duration > 0) {
        timers.current.push(
          window.setTimeout(() => dismiss(id), duration),
        );
      }
    };

    const handleNotification = (event: Event) => {
      const detail = (event as CustomEvent<NotificationDetail>).detail;
      push(detail);
    };

    window.addEventListener(NOTIFICATION_EVENT, handleNotification);

    return () => {
      mounted.current = false;
      window.removeEventListener(NOTIFICATION_EVENT, handleNotification);
      timers.current.forEach((t) => clearTimeout(t));
      timers.current = [];
    };
  }, []);

  const close = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="notification-center" role="region" aria-live="polite" aria-label="Notificaciones">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`notification notification--${n.type}`}
          role={n.type === 'success' || n.type === 'info' ? 'status' : 'alert'}
        >
          <span className="notification-icon" aria-hidden="true">
            {iconFor(n.type)}
          </span>
          <div className="notification-body">
            {n.title && <strong className="notification-title">{n.title}</strong>}
            <p className="notification-message">{n.message}</p>
            {n.action && (
              <button
                type="button"
                className="notification-action"
                onClick={() => {
                  n.action?.onClick();
                  close(n.id);
                }}
              >
                {n.action.label}
              </button>
            )}
          </div>
          <button
            type="button"
            className="notification-close"
            onClick={() => close(n.id)}
            aria-label="Cerrar notificación"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
