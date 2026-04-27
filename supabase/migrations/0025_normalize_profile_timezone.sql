-- 0025_normalize_profile_timezone.sql
--
-- Normalize legacy `profiles.timezone` values to the canonical short form
-- (ASCII hyphen, no city annotation). Pre-Batch-1 the dashboard editor
-- wrote Unicode minus (U+2212) and the onboarding modal wrote
-- "UTC-5 · New York (EST)" — both forms are now phased out in client code.
-- This migration brings any existing rows in line.
--
-- Idempotent: re-running produces no further changes once normalized.
-- Defense-in-depth on the client side (normalizeTimezone in
-- src/lib/grid/options.ts) handles any rows this migration misses, but
-- we want the DB itself clean for SQL filters and analytics.

BEGIN;

-- 1. Strip "· City (TZ)" annotations from any legacy onboarding rows.
--    "UTC-5 · New York (EST)" → "UTC-5"
UPDATE profiles
SET timezone = split_part(timezone, ' · ', 1)
WHERE timezone LIKE '% · %';

-- 2. Replace Unicode minus (U+2212, "−") with ASCII hyphen.
--    "UTC−5" → "UTC-5"
UPDATE profiles
SET timezone = REPLACE(timezone, '−', '-')
WHERE timezone LIKE '%−%';

COMMIT;
