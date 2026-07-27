import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';

interface NotificationRecord {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

function notificationRoute(notification: NotificationRecord, clientView: boolean): string | null {
  if (clientView) {
    if (notification.type.startsWith('reservation_')) return '/portal/reservations';
    if (notification.type.startsWith('approval.') || notification.type.startsWith('piece.')) return '/portal/approvals';
    return null;
  }
  if (notification.type.startsWith('piece.')) return '/production';
  if (notification.type.startsWith('lead.')) return '/crm/leads';
  if (notification.type.startsWith('reservation_')) return '/reservations';
  if (notification.type.startsWith('approval.')) return '/approvals';
  return null;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const countQuery = useQuery<{ unread: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get('/notifications/unread-count'),
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });

  const notificationsQuery = useQuery<NotificationRecord[]>({
    queryKey: ['notifications', 'list'],
    queryFn: () => api.get('/notifications'),
    enabled: Boolean(user && open),
    refetchInterval: open ? 30_000 : false,
  });

  const refreshNotifications = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] }),
    ]);
  };

  const markRead = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: refreshNotifications,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: refreshNotifications,
  });

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const openNotification = async (notification: NotificationRecord) => {
    if (!notification.read) await markRead.mutateAsync(notification.id);
    const route = notificationRoute(notification, user?.role === 'client');
    setOpen(false);
    if (route) navigate(route);
  };

  const notifications = notificationsQuery.data ?? [];
  const unread = countQuery.data?.unread ?? 0;

  return (
    <div className="notification-center" ref={rootRef}>
      <button
        type="button"
        className="notification-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {unread > 0 && <span className="notification-count">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <section className="notification-popover" role="dialog" aria-label="Centro de notificaciones">
          <header>
            <div>
              <span>ACTIVIDAD</span>
              <h3>Notificaciones</h3>
            </div>
            {unread > 0 && (
              <button type="button" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
                {markAllRead.isPending ? 'Marcando...' : 'Marcar todas leidas'}
              </button>
            )}
          </header>

          <div className="notification-list">
            {notificationsQuery.isLoading && <p className="notification-state">Cargando actividad...</p>}
            {notificationsQuery.error && (
              <div className="notification-state notification-state-error">
                <p>No fue posible cargar las alertas.</p>
                <button type="button" onClick={() => notificationsQuery.refetch()}>Reintentar</button>
              </div>
            )}
            {!notificationsQuery.isLoading && !notificationsQuery.error && notifications.length === 0 && (
              <div className="notification-empty">
                <span aria-hidden="true">0</span>
                <strong>Todo al dia</strong>
                <p>No tienes alertas pendientes.</p>
              </div>
            )}
            {notifications.map((notification) => {
              const route = notificationRoute(notification, user?.role === 'client');
              return (
                <button
                  type="button"
                  className={`notification-item ${notification.read ? '' : 'unread'}`}
                  key={notification.id}
                  onClick={() => openNotification(notification)}
                  disabled={markRead.isPending}
                >
                  <i aria-hidden="true" />
                  <span>
                    <strong>{notification.title}</strong>
                    <p>{notification.message}</p>
                    <small>{formatDate(notification.createdAt)}{route ? ' · Abrir' : ''}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
