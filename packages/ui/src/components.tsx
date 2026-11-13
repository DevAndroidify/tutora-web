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
  primary:
    'border-ink bg-brand text-accent-fg lift hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
  secondary: 'border-ink bg-surface text-text hover:bg-sunken',
  ghost: 'border-transparent text-text hover:bg-text/5',
  danger:
    'border-ink bg-danger text-white lift hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
};

/** Classes for a button-looking element (also used on router links). */
export function buttonClass(variant: Variant = 'primary', className?: string): string {
  return cn(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border-2 px-4 py-2',
    'text-[15px] font-bold transition-[transform,box-shadow,background-color]',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:translate-x-0 disabled:translate-y-0',
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
    'min-h-12 w-full rounded-[var(--radius-control)] border-2 bg-surface px-3.5 py-2.5 text-base text-text',
    'focus:outline-3 focus:outline-offset-2 focus:outline-ink',
    error ? 'border-danger' : 'border-ink',
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
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="text-[15px] font-bold">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[13px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[13px] font-bold text-danger">
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
  return (
    <div
      className={cn('rounded-[var(--radius-card)] border-2 border-ink bg-surface p-6', className)}
    >
      {children}
    </div>
  );
}

type Tone = 'info' | 'success' | 'warning' | 'danger';
const tones: Record<Tone, string> = {
  info: 'bg-sky',
  success: 'bg-mint',
  warning: 'bg-brand text-[#16161a]',
  danger: 'bg-pink',
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
        'rounded-[14px] border-2 border-ink px-4 py-3 text-[15px] leading-relaxed',
        tones[tone],
      )}
    >
      {title && <p className="font-bold">{title}</p>}
      {children && <div className={cn(title && 'mt-1')}>{children}</div>}
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
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        {kicker && <p className="mb-2 text-sm font-bold text-muted">{kicker}</p>}
        <h1 className="text-4xl font-extrabold leading-[1.05] md:text-5xl">{title}</h1>
        {description && <p className="mt-3 text-lg leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border-2 border-dashed border-ink/40 px-6 py-12 text-center">
      <p className="font-display text-xl font-extrabold">{title}</p>
      {children && <div className="mt-2 text-[15px] text-muted">{children}</div>}
    </div>
  );
}

/**
 * Page frame shared by all three apps: a white header with the highlighted
 * wordmark, the app's label, pill navigation and the account area, then a
 * plain footer. `strip` is a short line shown in the footer.
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
  /** Short line about the app, shown in the footer. */
  strip?: ReactNode;
  /** Shows the app label in red (the admin "control room"). */
  alertLabel?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg focus:border-2 focus:border-ink focus:bg-brand focus:p-2 focus:text-[#16161a]"
      >
        Skip to content
      </a>
      <header className="border-b-2 border-ink bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5">
          <a href="/" className="flex items-center gap-2.5">
            <span className="mark font-display text-[28px] font-extrabold tracking-[-0.03em]">
              tutora
            </span>
            <span
              className={cn(
                'rounded-full border-2 px-2 py-0.5 text-xs font-bold',
                alertLabel ? 'border-danger text-danger' : 'border-ink text-text',
              )}
            >
              {appName}
            </span>
          </a>
          <nav
            aria-label="Sections"
            className="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 pb-0.5 text-[15px]"
          >
            {nav}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">{account}</div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        {children}
      </main>
      <footer className="border-t-2 border-ink bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted">
          <span className="mark font-display text-xl font-extrabold text-text">tutora</span>
          {strip && <span>{strip}</span>}
          <span>Sessions are for learning, never financial advice.</span>
        </div>
      </footer>
    </div>
  );
}

/** Class for section-nav links; TanStack adds `.active` to the current one. */
export const navLinkClass =
  'whitespace-nowrap rounded-[10px] px-3 py-2 font-medium text-text hover:bg-sunken [&.active]:bg-ink [&.active]:text-bg';
