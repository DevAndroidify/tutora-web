import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@tutora/ui';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { timeFromNow } from './format';
import { useRealtimeEvent, useRealtimeStatus } from './realtime';
import type { AppNotification } from './types';

// ---------- toasts ----------

interface Toast {
  id: number;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
}

const ToastContext = createContext<((t: Omit<Toast, 'id'>) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = next.current++;
    setToasts((all) => [...all.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), 7000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="lift pointer-events-auto rounded-[14px] border-2 border-ink bg-surface p-4"
          >
            <p className="font-display text-lg font-extrabold leading-tight">{t.title}</p>
            {t.body && <p className="mt-1 text-sm text-muted">{t.body}</p>}
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  setToasts((all) => all.filter((x) => x.id !== t.id));
                }}
                className="mark mt-2 text-sm font-bold hover:underline"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Shows a short message in the corner; a no-op outside ToastProvider. */
export function useToast(): (t: Omit<Toast, 'id'>) => void {
  return useContext(ToastContext) ?? (() => undefined);
}

// ---------- notification centre ----------

export interface NotificationsApi {
  list(): Promise<AppNotification[]>;
  markRead(id: string): Promise<unknown>;
}

const KEY = ['notifications'] as const;

/**
 * Bell with unread count and a drop-down list. New notifications arrive over realtime,
 * are added to the list immediately and shown as a toast.
 */
export function NotificationBell({
  api,
  onOpen,
}: {
  api: NotificationsApi;
  onOpen: (n: AppNotification) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const live = useRealtimeStatus();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const list = useQuery({
    queryKey: KEY,
    queryFn: api.list,
    refetchInterval: live === 'live' ? false : 60_000,
  });
  const read = useMutation({
    mutationFn: (id: string) => api.markRead(id),
    onMutate: (id) =>
      qc.setQueryData<AppNotification[]>(KEY, (all) =>
        all?.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)),
      ),
  });

  const open_ = (n: AppNotification) => {
    if (!n.readAt) read.mutate(n.id);
    setOpen(false);
    onOpen(n);
  };

  useRealtimeEvent<AppNotification>('notification.created', (n) => {
    qc.setQueryData<AppNotification[]>(KEY, (all) =>
      all?.some((x) => x.id === n.id) ? all : [n, ...(all ?? [])],
    );
    toast({
      title: n.title,
      body: n.body || undefined,
      action: { label: 'Open', onClick: () => open_(n) },
    });
  });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        e instanceof KeyboardEvent ? e.key === 'Escape' : !panel.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const items = list.data ?? [];
  const unread = items.filter((n) => !n.readAt);

  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={unread.length ? `Notifications, ${unread.length} unread` : 'Notifications'}
        className="relative flex size-11 items-center justify-center rounded-full border-2 border-ink bg-surface hover:bg-brand hover:text-[#16161a]"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread.length > 0 && (
          <span className="absolute -right-2 -top-2 flex min-w-5 items-center justify-center rounded-full border-2 border-ink bg-danger px-1 text-xs font-extrabold text-white">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
        <span
          aria-hidden
          title={live === 'live' ? 'Live updates on' : 'Live updates paused'}
          className={cn(
            'absolute -bottom-1 -right-1 size-2.5 rounded-full border-2 border-surface',
            live === 'live' ? 'bg-success' : 'bg-muted',
          )}
        />
      </button>
      {open && (
        <div className="lift-lg absolute right-0 top-13 z-40 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[var(--radius-card)] border-2 border-ink bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-display text-lg font-extrabold">Notifications</p>
            {unread.length > 0 && (
              <button
                type="button"
                className="text-xs font-bold text-muted hover:text-text"
                onClick={() => unread.forEach((n) => read.mutate(n.id))}
              >
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Nothing yet.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {items.slice(0, 20).map((n) => (
                <li key={n.id} className="border-b border-border last:border-0">
                  <button
                    type="button"
                    onClick={() => open_(n)}
                    className="flex w-full gap-3 px-4 py-3 text-left hover:bg-sunken"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-1.5 size-2 shrink-0',
                        n.readAt ? 'bg-transparent' : 'bg-brand',
                      )}
                    />
                    <span>
                      <span className={cn('block text-sm', !n.readAt && 'font-bold')}>
                        {n.title}
                      </span>
                      {n.body && <span className="block text-xs text-muted">{n.body}</span>}
                      <span className="mt-1 block text-xs text-muted">
                        {timeFromNow(n.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
