-- Migration 0004: Add platform and pinned columns to profile_links
-- Required by the dashboard LinksCard (platform tabs + pin-to-profile feature).

ALTER TABLE profile_links ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'web';
ALTER TABLE profile_links ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;
