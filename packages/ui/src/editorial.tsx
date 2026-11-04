import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button, cn } from './components';

/** Small uppercase label above a headline ("FINANCE & INVESTING"). */
export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-[11px] font-bold uppercase tracking-[0.2em] text-muted', className)}>
      <span aria-hidden className="mr-2 inline-block h-2 w-2 bg-brand align-middle" />
      {children}
    </p>
  );
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
    <div className="mb-5 flex items-end justify-between gap-4 border-t-4 border-text pt-3">
      <h2 id={id} className="font-sans text-sm font-black uppercase tracking-[0.2em]">
        {title}
      </h2>
      {action && <div className="text-xs font-bold uppercase tracking-[0.12em]">{action}</div>}
    </div>
  );
}

const PALETTES = [
  ['#1f3d2b', '#3f7a52'],
  ['#0b3954', '#1f7a8c'],
  ['#7a2e1d', '#c8553d'],
  ['#1b1b3a', '#4a4e8c'],
  ['#6b4b16', '#d99a2b'],
  ['#2f3e46', '#52796f'],
  ['#3d1f3d', '#8c3f72'],
] as const;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Generated cover image: deep natural tones with contour-map lines, so every
 * skill and tutor gets a distinct, photo-free "cover" that reads as editorial art.
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
  const [from, to] = PALETTES[h % PALETTES.length]!;
  const cx = 20 + (h % 60);
  const cy = 25 + ((h >> 8) % 50);
  const rings = Array.from({ length: 9 }, (_, i) => 8 + i * 9 + ((h >> (i + 3)) % 4));
  const gid = `g${h.toString(36)}`;
  return (
    <div className={cn('relative overflow-hidden', ratio, className)} aria-hidden>
      <svg
        viewBox="0 0 100 66"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full"
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
        <rect width="100" height="66" fill={`url(#${gid})`} />
        {rings.map((r, i) => (
          <ellipse
            key={i}
            cx={cx}
            cy={cy}
            rx={r * 1.25}
            ry={r * 0.8}
            fill="none"
            stroke="white"
            strokeOpacity={0.09 + (i % 3) * 0.03}
            strokeWidth={0.4}
            transform={`rotate(${(h % 40) - 20} ${cx} ${cy})`}
          />
        ))}
      </svg>
      {label && (
        <span className="absolute bottom-2 right-3 font-display text-6xl font-black leading-none text-white/25">
          {label.slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );
}

/** Front-page story card: cover, kicker, serif headline, standfirst and meta line. */
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
            'story-title font-black leading-tight',
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
        {meta && (
          <div className="mt-auto pt-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
            {meta}
          </div>
        )}
      </div>
    </article>
  );
}

type TagTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'dark';
const tagTones: Record<TagTone, string> = {
  neutral: 'border border-border text-muted',
  brand: 'bg-brand text-black',
  success: 'bg-success text-white',
  warning: 'bg-warning text-white',
  danger: 'bg-danger text-white',
  dark: 'bg-night text-white',
};

export function Tag({ tone = 'neutral', children }: { tone?: TagTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em]',
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
    <div
      role="tablist"
      aria-label={label}
      className="mb-6 flex gap-1 overflow-x-auto border-b border-border"
    >
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={it.value === value}
          onClick={() => onChange(it.value)}
          className={cn(
            '-mb-px whitespace-nowrap border-b-4 px-3 py-2.5 text-xs font-bold uppercase tracking-[0.12em]',
            it.value === value
              ? 'border-brand text-text'
              : 'border-transparent text-muted hover:text-text',
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
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
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
    <div className="border-t-4 border-text pt-3">
      <p className="font-display text-5xl font-black leading-none">{value}</p>
      <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em]">{label}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
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
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="w-full max-w-lg border-t-8 border-brand bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={id} className="text-2xl font-black">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-2xl leading-none text-muted hover:text-text"
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
    <dl className="grid grid-cols-[max-content_1fr] gap-x-8 gap-y-3 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
