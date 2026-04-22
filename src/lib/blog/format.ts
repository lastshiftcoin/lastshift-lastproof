/**
 * Display formatters for blog UI.
 *
 * All uppercase display dates (`APR 15, 2026`) per wireframe. Reading
 * time rendered as `5 MIN READ`. Both are pure functions.
 */

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/**
 * Format a YYYY-MM-DD string as "APR 15, 2026".
 * Parsed manually (not via `new Date()`) to avoid TZ shifts that could
 * push the displayed date off by one day.
 */
export function formatDisplayDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const [, y, mm, dd] = m;
  const monthIdx = parseInt(mm, 10) - 1;
  const day = parseInt(dd, 10);
  return `${MONTHS[monthIdx]} ${day}, ${y}`;
}

export function formatReadingTime(minutes: number): string {
  return `${minutes} MIN READ`;
}
