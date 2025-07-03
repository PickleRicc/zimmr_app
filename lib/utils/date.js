// Utility functions for date & time handling in local timezone
// Converts an ISO string in UTC to local date & time strings.
// Returns { date: 'YYYY-MM-DD', time: 'HH:MM' }
export function splitLocalDateTime(iso) {
  if (!iso) {
    return { date: 'N/A', time: 'N/A' };
  }
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

// Formats ISO string to a readable locale string in local timezone
export function formatLocal(iso, locale = 'de-DE') {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
