const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

/** 50000 -> "₹500" (amounts travel as integer paise). */
export function formatINR(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '—';
  return inr.format(paise / 100).replace(/\.00$/, '');
}

/** "500" or "499.50" rupees -> paise; undefined for blank, NaN for junk. */
export function rupeesToPaise(value: string): number | undefined {
  const v = value.trim();
  if (!v) return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return Number.NaN;
  return Math.round(Number(v) * 100);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "3 hours ago" / "in 2 days". */
export function timeFromNow(iso: string, now: number = Date.now()): string {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  const [value, unit]: [number, Intl.RelativeTimeFormatUnit] =
    abs < 60
      ? [diff, 'second']
      : abs < 3600
        ? [diff / 60, 'minute']
        : abs < 86400
          ? [diff / 3600, 'hour']
          : [diff / 86400, 'day'];
  return rtf.format(Math.round(value), unit);
}

/** "RESTRICT_POSTING" -> "Restrict posting". */
export function humanize(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');
}
