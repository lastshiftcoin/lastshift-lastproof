-- 0021: Chad Function — wallet-keyed friend graph for the public profile.
--
-- Each row represents either a pending chad request or an accepted
-- chadship between two operator wallets. The graph is wallet-keyed
-- (NOT profile-id-keyed) so relationships persist through profile
-- lapses (free / unpublished). When either side reactivates, the
-- relationship reappears in the public army without a re-request.
--
-- Lifecycle:
--   pending  — requester sent a request; target has not responded
--   accepted — target accepted; both are now chads
--
-- Deny is implemented as a hard row-delete in app code (no "denied"
-- status, no soft-tombstone). Re-request is therefore automatically
-- possible after a deny — the unique constraint just finds no
-- existing row. "Ignore" is the no-op path: the row sits pending
-- forever and the unique constraint blocks re-asks from the same
-- requester. This is the documented "Facebook-style" go-away-forever
-- without an explicit block feature.
--
-- All writes go through service-role API routes. RLS is deny-all for
-- anon (default once enabled — no policies declared).

create table if not exists chads (
  id                 bigserial primary key,
  requester_wallet   text not null,
  target_wallet      text not null,
  status             text not null check (status in ('pending', 'accepted')),
  created_at         timestamptz not null default now(),
  accepted_at        timestamptz,
  -- One row per directional pair. Deny path hard-deletes the row,
  -- letting a fresh request reuse the same pair later.
  unique (requester_wallet, target_wallet),
  -- Disallow self-chad.
  check (requester_wallet <> target_wallet)
);

-- Hot path: target's pending queue (dashboard) and target's accepted
-- list (public army when viewer is the target).
create index if not exists chads_target_status_idx
  on chads (target_wallet, status);

-- Hot path: requester's pending queue (modal "Request Pending" check)
-- and requester's accepted list (their own army view).
create index if not exists chads_requester_status_idx
  on chads (requester_wallet, status);

alter table chads enable row level security;
