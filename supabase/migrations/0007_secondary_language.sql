-- Add secondary language column to profiles.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS secondary_language text;
