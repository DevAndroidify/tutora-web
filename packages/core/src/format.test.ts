import { describe, expect, it } from 'vitest';
import { formatINR, humanize, rupeesToPaise, timeFromNow } from './format';

describe('format', () => {
  it('formats paise as rupees', () => {
    expect(formatINR(50000)).toBe('₹500');
    expect(formatINR(49950)).toBe('₹499.50');
    expect(formatINR(null)).toBe('—');
  });

  it('parses rupees into paise', () => {
    expect(rupeesToPaise('500')).toBe(50000);
    expect(rupeesToPaise('499.5')).toBe(49950);
    expect(rupeesToPaise('  ')).toBeUndefined();
    expect(rupeesToPaise('5e3')).toBeNaN();
    expect(rupeesToPaise('1.234')).toBeNaN();
  });

  it('describes relative time', () => {
    const now = Date.parse('2026-11-03T12:00:00Z');
    expect(timeFromNow('2026-11-06T12:00:00Z', now)).toBe('in 3 days');
    expect(timeFromNow('2026-11-03T09:00:00Z', now)).toBe('3 hours ago');
  });

  it('humanizes enum values', () => {
    expect(humanize('RESTRICT_POSTING')).toBe('Restrict posting');
  });
});
