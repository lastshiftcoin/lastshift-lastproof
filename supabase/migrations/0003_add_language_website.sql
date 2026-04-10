-- Add language and website columns to profiles.
-- language: primary language from onboarding (e.g. "English", "Spanish")
-- website: personal website URL

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website text;
