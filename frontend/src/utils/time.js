const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const plural = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;

/** "Sep 29, 2026" */
export const formatShortDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Human friendly age of a timestamp: "Just now", "2 minutes ago", "1 hour ago",
 * "Yesterday", then an absolute date ("Sep 29, 2026"). Returns '' for unusable input.
 */
export const formatRelativeTime = (value, now = Date.now()) => {
  if (value === null || value === undefined || value === '') return '';
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return '';

  const diff = now - then.getTime();
  if (diff < MINUTE) return 'Just now'; // also covers small client/server clock skew (negative diff)
  if (diff < HOUR) return plural(Math.floor(diff / MINUTE), 'minute');

  const dayGap = Math.round((startOfDay(new Date(now)) - startOfDay(then)) / (24 * HOUR));
  if (dayGap <= 0) return plural(Math.floor(diff / HOUR), 'hour');
  if (dayGap === 1) return 'Yesterday';
  return formatShortDate(then);
};
