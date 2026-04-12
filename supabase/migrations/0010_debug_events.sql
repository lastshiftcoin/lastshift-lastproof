-- 0010: Debug event log for proof flow observability.
--
-- Captures wallet adapter events, proof flow state transitions, API
-- request/response pairs, and MWA-specific events. Single-user debug
-- tool — no RLS needed, service role writes only.

CREATE TABLE IF NOT EXISTS debug_events (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    timestamptz DEFAULT now() NOT NULL,

  -- Session grouping: random ID generated per proof modal open
  session_id    text NOT NULL,

  -- Event classification
  category      text NOT NULL,   -- 'wallet' | 'proof_flow' | 'api' | 'sign' | 'mwa' | 'error'
  event         text NOT NULL,   -- e.g. 'adapter_selected', 'step_transition', 'build_tx_response'

  -- Flexible payload — whatever context is relevant
  payload       jsonb DEFAULT '{}'::jsonb,

  -- Client metadata (captured once per session, sent with every event)
  user_agent    text,
  wallet_env    text,            -- 'desktop' | 'in-app-browser' | 'mobile-browser'
  is_android    boolean DEFAULT false
);

-- Query by session or time range
CREATE INDEX idx_debug_events_session ON debug_events (session_id);
CREATE INDEX idx_debug_events_created ON debug_events (created_at DESC);
CREATE INDEX idx_debug_events_category ON debug_events (category, event);
