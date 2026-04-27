/**
 * Canonical lists of selectable languages and timezones for LASTPROOF
 * profiles. Single source of truth — every surface (onboarding,
 * dashboard editor, Grid filter, SHIFTBOT validator) imports from here.
 *
 * Decisions (Kellen, 2026-04-26):
 *  - Languages: 16 names. Stored + displayed as full English names.
 *    No 2-letter codes anywhere.
 *  - Timezones: 26 short UTC offsets, ASCII hyphen "-" (NOT Unicode
 *    minus "−"). Cities are display-only labels in the dashboard
 *    dropdowns; stored value is the bare offset.
 *
 * If a new language or timezone is added, also update the SHIFTBOT
 * prompt's slug-mapping section in src/lib/shiftbot/prompt.ts.
 */

export const LANGUAGES = [
  "English",
  "Spanish",
  "Mandarin",
  "Japanese",
  "Korean",
  "French",
  "German",
  "Portuguese",
  "Russian",
  "Arabic",
  "Turkish",
  "Vietnamese",
  "Tagalog",
  "Hindi",
  "Indonesian",
  "Thai",
] as const;

export type Language = typeof LANGUAGES[number];

export const TIMEZONES = [
  "UTC-12",
  "UTC-11",
  "UTC-10",
  "UTC-9",
  "UTC-8",
  "UTC-7",
  "UTC-6",
  "UTC-5",
  "UTC-4",
  "UTC-3",
  "UTC-2",
  "UTC-1",
  "UTC+0",
  "UTC+1",
  "UTC+2",
  "UTC+3",
  "UTC+4",
  "UTC+5",
  "UTC+5:30",
  "UTC+6",
  "UTC+7",
  "UTC+8",
  "UTC+9",
  "UTC+10",
  "UTC+11",
  "UTC+12",
] as const;

export type Timezone = typeof TIMEZONES[number];

/**
 * Display-only city annotations for dashboard timezone dropdowns. The
 * stored value is always the bare offset key — the city string just
 * helps users find their zone. NOT used in Grid filter, profile cards,
 * or SHIFTBOT.
 */
export const TIMEZONE_CITY_LABELS: Record<Timezone, string> = {
  "UTC-12": "Baker Island",
  "UTC-11": "Pago Pago",
  "UTC-10": "Honolulu (HST)",
  "UTC-9": "Anchorage (AKST)",
  "UTC-8": "Los Angeles (PST)",
  "UTC-7": "Denver (MST)",
  "UTC-6": "Mexico City (CST)",
  "UTC-5": "New York (EST)",
  "UTC-4": "Caracas / Halifax",
  "UTC-3": "São Paulo / Buenos Aires",
  "UTC-2": "South Georgia",
  "UTC-1": "Azores",
  "UTC+0": "London (GMT)",
  "UTC+1": "Berlin / Paris (CET)",
  "UTC+2": "Athens / Cairo (EET)",
  "UTC+3": "Moscow / Istanbul",
  "UTC+4": "Dubai",
  "UTC+5": "Karachi / Islamabad",
  "UTC+5:30": "Mumbai / Delhi (IST)",
  "UTC+6": "Dhaka / Almaty",
  "UTC+7": "Bangkok / Jakarta / HCMC",
  "UTC+8": "Singapore / HK / Beijing",
  "UTC+9": "Tokyo / Seoul",
  "UTC+10": "Sydney / Melbourne",
  "UTC+11": "Solomon Islands",
  "UTC+12": "Auckland / Fiji",
};

/** O(1) allowlist sets for validation in url-params + SHIFTBOT validator. */
export const LANGUAGES_SET: ReadonlySet<string> = new Set<string>(LANGUAGES);
export const TIMEZONES_SET: ReadonlySet<string> = new Set<string>(TIMEZONES);

/**
 * Normalize a raw timezone string read from DB to canonical form.
 * Defense-in-depth for legacy rows that may still hold:
 *  - Unicode minus (U+2212) instead of ASCII hyphen
 *  - " · City (TZ)" annotation appended (from old onboarding flow)
 *
 * Always returns a value present in TIMEZONES, or null if no canonical
 * match (caller decides how to handle — usually fall back to display "—").
 */
export function normalizeTimezone(
  raw: string | null | undefined,
): Timezone | null {
  if (!raw) return null;
  const head = raw.split(" · ")[0];
  const ascii = head.replace(/−/g, "-");
  return TIMEZONES_SET.has(ascii) ? (ascii as Timezone) : null;
}

/**
 * Normalize a raw language string to canonical form. Case-insensitive
 * match against the 16-name LANGUAGES list — accepts "spanish",
 * "Spanish", "SPANISH" and returns "Spanish". Returns null if no match
 * (caller decides whether to drop or fall back).
 */
export function normalizeLanguage(
  raw: string | null | undefined,
): Language | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  for (const lang of LANGUAGES) {
    if (lang.toLowerCase() === lower) return lang;
  }
  return null;
}
