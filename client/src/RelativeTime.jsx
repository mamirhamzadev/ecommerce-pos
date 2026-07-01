import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import updateLocale from 'dayjs/plugin/updateLocale';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(relativeTime);
dayjs.extend(updateLocale);

/**
 * SQLite `datetime('now')` is stored as UTC without a `Z` suffix. Plain dayjs()
 * treats that string as local wall time, which skews `fromNow()` by the
 * machine's offset from UTC (e.g. ~5 hours in Pakistan).
 */
export function parseDbTimestamp(iso) {
  if (iso == null || iso === '') return null;
  const s = String(iso).trim();
  if (!s) return null;
  if (/Z|[+-]\d{2}:?\d{2}$/.test(s)) {
    return dayjs(s);
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    const normalized = s.includes('T') ? s : s.replace(' ', 'T');
    return dayjs.utc(normalized);
  }
  return dayjs(s);
}

dayjs.updateLocale('en', {
  relativeTime: {
    future: 'in %s',
    past: '%s ago',
    s: '%d sec',
    m: '1 min',
    mm: '%d mins',
    h: '1 hr',
    hh: '%d hrs',
    d: '1 day',
    dd: '%d days',
    M: '1 mo',
    MM: '%d mos',
    y: '1 yr',
    yy: '%d yrs',
  },
});

export function formatRelative(iso) {
  const d = parseDbTimestamp(iso);
  if (!d || !d.isValid()) return iso == null || iso === '' ? '—' : String(iso);
  return d.fromNow();
}

export function formatAbsolute(iso) {
  const d = parseDbTimestamp(iso);
  if (!d || !d.isValid()) return iso == null || iso === '' ? '' : String(iso);
  return d.local().format('YYYY-MM-DD HH:mm:ss');
}

export function useRelativeTime(iso, intervalMs = 15000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [iso, intervalMs]);
  return formatRelative(iso);
}

/**
 * @param {{ value: string | null | undefined, className?: string }} props
 */
export function RelativeTime({ value, className }) {
  const text = useRelativeTime(value);
  const title = formatAbsolute(value);
  return (
    <span className={className} title={title || undefined}>
      {text}
    </span>
  );
}
