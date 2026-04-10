-- Seed categories from the onboarding wireframe.
-- These match the chips in lastproof-onboarding.html Step 2.

INSERT INTO categories (slug, label, position) VALUES
  ('community-manager', 'Community Manager', 1),
  ('mod', 'Mod', 2),
  ('raid-leader', 'Raid Leader', 3),
  ('shiller', 'Shiller', 4),
  ('alpha-caller', 'Alpha Caller', 5),
  ('kol-influencer', 'KOL / Influencer', 6),
  ('space-host-ama-host', 'Space Host / AMA Host', 7),
  ('content-creator', 'Content Creator', 8),
  ('collab-manager', 'Collab Manager', 9),
  ('growth-paid-media', 'Growth / Paid Media', 10),
  ('brand-creative', 'Brand / Creative', 11),
  ('bd-partnerships', 'BD / Partnerships', 12),
  ('pr-comms', 'PR / Comms', 13),
  ('vibe-coder-builder', 'Vibe Coder / Builder', 14),
  ('token-dev-tokenomics', 'Token Dev / Tokenomics', 15)
ON CONFLICT (slug) DO NOTHING;
