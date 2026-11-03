import { clsx } from 'clsx';
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

export const cn = clsx;

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-accent-fg hover:brightness-95',
  secondary: 'border-2 border-text text-text hover:bg-text hover:text-bg',
  ghost: 'text-text hover:bg-text/5',
  danger: 'bg-danger text-white hover:brightness-110',
};

/** Classes for a button-looking element (also used on router links). */
export function buttonClass(variant: Variant = 'primary', className?: string): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 py-2.5',
    'text-xs font-bold uppercase tracking-[0.12em] transition',
    'disabled:cursor-not-allowed disabled:opacity-50',
    variants[variant],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading = false, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, className)}
      {...rest}
    >
      {loading && <Spinner className="size-3.5" label="" />}
      {children}
    </button>
  );
});

const controlClass = (error?: string) =>
  cn(
    'w-full rounded-[var(--radius-control)] border bg-surface px-3 py-2.5 text-sm text-text outline-none',
    'focus:border-text focus:shadow-[0_0_0_3px_var(--color-brand)]',
    error ? 'border-danger' : 'border-border',
  );

function FieldFrame({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-bold uppercase tracking-[0.1em]">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = (id: string, error?: string, hint?: string) =>
  [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

/** Labelled input with error and hint wired to aria attributes. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <FieldFrame id={inputId} label={label} error={error} hint={hint} className={className}>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, error, hint)}
        className={controlClass(error)}
        {...rest}
      />
    </FieldFrame>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, id, className, rows = 4, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <FieldFrame id={inputId} label={label} error={error} hint={hint} className={className}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, error, hint)}
        className={controlClass(error)}
        {...rest}
      />
    </FieldFrame>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, id, className, children, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <FieldFrame id={inputId} label={label} error={error} hint={hint} className={className}>
      <select
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, error, hint)}
        className={controlClass(error)}
        {...rest}
      >
        {children}
      </select>
    </FieldFrame>
  );
});

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('border border-border bg-surface p-6', className)}>{children}</div>;
}

type Tone = 'info' | 'success' | 'warning' | 'danger';
const tones: Record<Tone, string> = {
  info: 'border-l-brand',
  success: 'border-l-success',
  warning: 'border-l-warning',
  danger: 'border-l-danger',
};

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'border border-l-[6px] border-border bg-surface px-4 py-3 text-sm',
        tones[tone],
      )}
    >
      {title && <p className="font-bold">{title}</p>}
      {children && <div className={cn(title && 'mt-1', 'text-muted')}>{children}</div>}
    </div>
  );
}

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role={label ? 'status' : undefined} className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={cn(
          'inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent',
          className,
        )}
      />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

/** Centered loading state for a page or section. */
export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex justify-center py-16">
      <Spinner label={label} />
    </div>
  );
}

export function PageHeader({
  title,
  kicker,
  description,
  actions,
}: {
  title: string;
  kicker?: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b-4 border-text pb-5">
      <div className="max-w-3xl">
        {kicker && (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-muted">
            <span aria-hidden className="mr-2 inline-block h-2.5 w-2.5 bg-brand" />
            {kicker}
          </p>
        )}
        <h1 className="text-4xl font-black leading-[1.05] md:text-5xl">{title}</h1>
        {description && <p className="mt-3 text-lg leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border-2 border-dashed border-border px-6 py-12 text-center">
      <p className="font-display text-xl font-bold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

const today = () =>
  new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

/**
 * Page frame shared by all three apps, styled like a news masthead:
 * a black dateline strip, a serif wordmark with the app's section label,
 * a ruled section navigation, and a black footer.
 */
export function AppShell({
  appName,
  nav,
  account,
  strip,
  alertLabel = false,
  children,
}: {
  appName: string;
  nav?: ReactNode;
  account?: ReactNode;
  /** Short text on the right of the dateline strip. */
  strip?: ReactNode;
  /** Shows the section label in red (the admin "control room"). */
  alertLabel?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:bg-brand focus:p-2 focus:text-black"
      >
        Skip to content
      </a>
      <div className="bg-night text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
        <div className="mx-auto flex h-8 max-w-6xl items-center justify-between gap-4 px-4">
          <span className="truncate">{today()}</span>
          <span className="hidden truncate sm:inline">{strip}</span>
        </div>
      </div>
      <header className="bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4">
          <a href="/" className="flex items-baseline gap-3">
            <span
              aria-hidden
              className="inline-block h-7 w-5 self-center border-[5px] border-brand"
            />
            <span className="font-display text-3xl font-black uppercase tracking-tight md:text-4xl">
              Tutora
            </span>
            <span
              className={cn(
                'text-xs font-bold uppercase tracking-[0.25em]',
                alertLabel ? 'text-danger' : 'text-muted',
              )}
            >
              {appName}
            </span>
          </a>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">{account}</div>
        </div>
        <div className="border-y-2 border-text">
          <nav
            aria-label="Sections"
            className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-2 text-xs font-bold uppercase tracking-[0.14em]"
          >
            {nav}
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        {children}
      </main>
      <footer className="bg-night text-white/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-xs">
          <span className="font-display text-xl font-black uppercase text-white">Tutora</span>
          <span>
            Learn any skill from verified people. Sessions are educational, never financial advice.
          </span>
        </div>
      </footer>
    </div>
  );
}

/** Class for section-nav links; TanStack adds `.active` to the current one. */
export const navLinkClass =
  'whitespace-nowrap border-b-4 border-transparent px-3 py-3 text-muted hover:text-text [&.active]:border-brand [&.active]:text-text';
