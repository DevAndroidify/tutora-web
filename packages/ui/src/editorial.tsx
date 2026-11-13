import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button, cn } from './components';

/** Small label above a headline ("Finance & Investing"). */
export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-sm font-bold text-muted', className)}>{children}</p>;
}

/** Section heading with a heavy rule above it, like a newspaper section. */
export function SectionHeader({
  title,
  action,
  id,
}: {
  title: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 id={id} className="text-2xl font-extrabold">
        {title}
      </h2>
      {action && <div className="text-sm font-bold">{action}</div>}
    </div>
  );
}

const PALETTES = ['#fff27a', '#b8f2d0', '#ffc6e0', '#bfe0ff', '#ffd9a8', '#e3d7ff'] as const;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Generated cover: a flat pastel block with the subject's initial and a few
 * ruled lines, so every skill and tutor gets a distinct, photo-free cover.
 */
export function CoverArt({
  seed,
  label,
  className,
  ratio = 'aspect-[3/2]',
}: {
  seed: string;
  label?: string;
  className?: string;
  ratio?: string;
}) {
  const h = hash(seed);
  const fill = PALETTES[h % PALETTES.length]!;
  const lines = 3 + (h % 3);
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[14px] border-2 border-[#16161a]',
        ratio,
        className,
      )}
      style={{ background: fill }}
      aria-hidden
    >
      <div className="absolute inset-x-4 top-4 flex flex-col gap-2">
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className="h-1.5 rounded-full bg-[#16161a]/15"
            style={{ width: `${40 + ((h >> (i * 3)) % 45)}%` }}
          />
        ))}
      </div>
      {label && (
        <span className="absolute bottom-1 right-3 font-display text-6xl font-extrabold leading-none text-[#16161a]">
          {label.slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );
}

/** Card for a skill or tutor: cover, kicker, headline, short description and meta line. */
export function StoryCard({
  seed,
  kicker,
  title,
  dek,
  meta,
  size = 'md',
  cover = true,
}: {
  seed: string;
  kicker?: ReactNode;
  title: string;
  dek?: ReactNode;
  meta?: ReactNode;
  size?: 'lg' | 'md' | 'sm';
  cover?: boolean;
}) {
  return (
    <article className="story flex h-full flex-col">
      {cover && (
        <CoverArt
          seed={seed}
          label={title}
          ratio={size === 'lg' ? 'aspect-[16/9]' : 'aspect-[3/2]'}
        />
      )}
      <div className={cn('flex flex-1 flex-col', cover && 'pt-4')}>
        {kicker && <Kicker className="mb-2">{kicker}</Kicker>}
        <h3
          className={cn(
            'story-title w-fit font-extrabold leading-tight',
            size === 'lg' ? 'text-3xl md:text-4xl' : size === 'md' ? 'text-xl' : 'text-lg',
          )}
        >
          {title}
        </h3>
        {dek && (
          <p
            className={cn(
              'mt-2 text-muted',
              size === 'lg' ? 'text-lg leading-relaxed' : 'text-sm leading-relaxed',
            )}
          >
            {dek}
          </p>
        )}
        {meta && <div className="mt-auto pt-3 text-sm font-medium text-muted">{meta}</div>}
      </div>
    </article>
  );
}

type TagTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'dark';
const tagTones: Record<TagTone, string> = {
  neutral: 'bg-surface text-text',
  brand: 'bg-brand text-[#16161a]',
  success: 'bg-mint text-text',
  warning: 'bg-[#ffd9a8] text-[#16161a]',
  danger: 'bg-pink text-text',
  dark: 'bg-ink text-bg',
};

export function Tag({ tone = 'neutral', children }: { tone?: TagTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-bold',
        tagTones[tone],
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, TagTone> = {
  DRAFT: 'neutral',
  NOT_SUBMITTED: 'neutral',
  OPEN: 'brand',
  PENDING: 'warning',
  POOLED: 'brand',
  RESERVED: 'brand',
  BOOKED: 'success',
  VERIFIED: 'success',
  APPROVED: 'success',
  ACTIVE: 'success',
  COMPLETED: 'dark',
  ACTIONED: 'dark',
  EXPERT: 'dark',
  EXPIRED: 'neutral',
  DISMISSED: 'neutral',
  CANCELLED: 'neutral',
  REJECTED: 'danger',
  SUSPENDED: 'danger',
  BANNED: 'danger',
  INITIATED: 'warning',
  HELD: 'brand',
  FROZEN: 'danger',
  RELEASED: 'success',
  REFUNDED: 'dark',
  FAILED: 'danger',
  RESOLVED_RELEASE: 'success',
  RESOLVED_REFUND: 'dark',
  INVITED: 'warning',
  ACCEPTED: 'success',
  DECLINED: 'neutral',
  FORMING: 'warning',
  BIDDING: 'brand',
  AWAITING_PAYMENTS: 'warning',
  CONFIRMED: 'success',
  SCHEDULED: 'success',
  PENDING_PAYMENT: 'warning',
  LIVE: 'danger',
  ENDED: 'dark',
};

/** Status word from the API rendered as a tag ("NOT_SUBMITTED" -> "Not submitted"). */
export function StatusTag({ status }: { status: string }) {
  const text = status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
  return <Tag tone={STATUS_TONES[status] ?? 'neutral'}>{text}</Tag>;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="mb-6 flex gap-2 overflow-x-auto pb-1">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={it.value === value}
          onClick={() => onChange(it.value)}
          className={cn(
            'min-h-10 whitespace-nowrap rounded-[10px] border-2 border-ink px-3.5 text-sm font-bold',
            it.value === value
              ? 'bg-brand text-[#16161a] lift'
              : 'bg-surface text-text hover:bg-sunken',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Pagination({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex items-center justify-between border-t border-border pt-4"
    >
      <Button
        variant="ghost"
        disabled={page <= 1}
        onClick={() => onChange(Math.max(0, offset - limit))}
      >
        ← Previous
      </Button>
      <span className="text-sm font-bold text-muted">
        Page {page} of {pages}
      </span>
      <Button variant="ghost" disabled={page >= pages} onClick={() => onChange(offset + limit)}>
        Next →
      </Button>
    </nav>
  );
}

/** Big number with a label, for dashboards ("12 · Pending reviews"). */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border-2 border-ink bg-surface px-4 py-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-4xl font-extrabold leading-none">{value}</p>
      {hint && <p className="mt-2 text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

/** Accessible modal: labelled, closes on Escape and backdrop click, focuses its first field. */
export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  // Keep the latest onClose without re-running the effect: re-running it on every render
  // would steal focus from whatever field the user is typing in.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const restore = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      // Keep Tab inside the dialog.
      if (e.key === 'Tab' && panel.current) {
        const items = [
          ...panel.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ];
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const p = panel.current;
    (
      p?.querySelector<HTMLElement>('input, select, textarea') ??
      p?.querySelector<HTMLElement>('button')
    )?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      restore?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-[#16161a]/50 p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="lift-lg w-full max-w-lg rounded-[var(--radius-card)] border-2 border-ink bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={id} className="text-2xl font-extrabold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-10 place-items-center rounded-[10px] text-2xl leading-none text-muted hover:bg-sunken hover:text-text"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Definition list in two columns, for detail pages. */
export function Facts({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-8 gap-y-3 text-[15px]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
