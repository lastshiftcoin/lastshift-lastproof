-- Add sequential early adopter number column.
-- Assigned at campaign claim time (/api/campaign/claim).
-- Unique constraint ensures no duplicate numbers.

ALTER TABLE profiles ADD COLUMN ea_number integer UNIQUE;

-- Index for fast max() lookup when assigning next number
CREATE INDEX idx_profiles_ea_number ON profiles (ea_number) WHERE ea_number IS NOT NULL;
