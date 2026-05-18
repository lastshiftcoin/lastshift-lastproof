/**
 * Weekly ambassador window — Sunday 20:00 America/Los_Angeles boundary.
 *
 * Habilamar's $80/month retainer is structured around a 250-referral
 * weekly quota. Weeks run from Sunday 8:00pm Pacific Time (anchor:
 * America/Los_Angeles, so DST is handled automatically by the runtime)
 * to the following Sunday at 7:59:59pm Pacific.
 *
 * `getCurrentWeekWindowPT(now?)` returns the boundaries as plain UTC
 * Date objects so they can be passed to Supabase queries unmodified.
 *
 * `formatInTz(date, tz, opts?)` is a thin Intl.DateTimeFormat wrapper
 * used by the report page to render the same boundaries in Habilamar's
 * local (Europe/Istanbul, UTC+3).
 *
 * DST footnote: the boundary calculation is wall-clock-accurate to the
 * second except for the ~1hr period around the two yearly DST shifts
 * in LA. For a referral FOMO bar, this is fine — the count query uses
 * the resulting UTC instant consistently.
 */

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const PT_TZ = "America/Los_Angeles";
const WEEK_BOUNDARY_HOUR = 20; // 8pm

export interface WeekWindow {
  /** Sunday 20:00:00 Pacific, in UTC. Inclusive lower bound. */
  start: Date;
  /** Following Sunday 19:59:59 Pacific, in UTC. Inclusive upper bound. */
  end: Date;
}

/**
 * Resolve the current week window. Pass an explicit `now` for tests.
 */
export function getCurrentWeekWindowPT(now: Date = new Date()): WeekWindow {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PT_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekday = get("weekday"); // "Sun".."Sat"
  // Intl returns "24" instead of "00" at midnight in some runtimes; normalize.
  const rawHour = parseInt(get("hour"), 10);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = parseInt(get("minute"), 10);
  const second = parseInt(get("second"), 10);

  const dayIdx = WEEKDAY_INDEX[weekday];

  // Days back to the most recent Sunday 20:00 PT.
  // If today is Sunday and clock hasn't passed 20:00 yet, the week
  // started LAST Sunday (7 days back).
  let daysBack: number;
  if (dayIdx === 0) {
    daysBack = hour < WEEK_BOUNDARY_HOUR ? 7 : 0;
  } else {
    daysBack = dayIdx;
  }

  // Wall-clock seconds elapsed since the boundary (Sunday 20:00 PT).
  // For (Sunday, hour < 20), daysBack=7 covers the negative (hour-20).
  const elapsedSeconds =
    daysBack * 86_400 + (hour - WEEK_BOUNDARY_HOUR) * 3_600 + minute * 60 + second;

  const start = new Date(now.getTime() - elapsedSeconds * 1000);
  start.setMilliseconds(0);

  // End of week: +7 days - 1 second
  const end = new Date(start.getTime() + 7 * 86_400_000 - 1000);

  return { start, end };
}

/**
 * Format a Date in an arbitrary IANA timezone. Defaults give a compact
 * "Sun Apr 27, 8:00 PM" style; pass custom options to override.
 */
export function formatInTz(
  date: Date,
  tz: string,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...opts,
  }).format(date);
}

/**
 * Short tz suffix label like "UTC+3" derived from an IANA tz at the
 * given instant. Defaults to `new Date()`. Used in the report header
 * eyebrow ("WEEK · UTC+3").
 */
export function tzOffsetLabel(tz: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  }).formatToParts(at);
  const tzn = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  // shortOffset returns "GMT+3", "GMT-08:00", "GMT" — normalize to "UTC±N"
  if (tzn === "GMT") return "UTC";
  const m = tzn.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return tzn;
  const sign = m[1];
  const h = parseInt(m[2], 10);
  const min = m[3] ? `:${m[3]}` : "";
  return `UTC${sign}${h}${min}`;
}
