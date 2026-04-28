-- 0023: Ambassador per-referral payout tracking
--
-- Replaces the rolling-7-day tier model with flat $0.50 per confirmed
-- referral. Each referral gets an explicit paid/unpaid status linked
-- to the ambassador_payouts row that paid it. Lets the admin (Kellen)
-- mark all unpaid referrals as paid in a single atomic operation,
-- and lets ambassadors see ✓/⏳ status per referral on their report.
--
-- Schema additions:
--   profiles.ambassador_paid_at      — timestamp of payout, NULL = unpaid
--   profiles.ambassador_payout_id    — FK to ambassador_payouts row
--   idx_profiles_referred_by_paid    — fast unpaid-referrals queries
--   mark_ambassador_referrals_paid() — atomic Postgres function
--
-- Why a Postgres function:
--   Marking N referrals paid + inserting one payout row is two writes.
--   If the payout insert succeeds but the profile updates fail mid-way
--   (or vice versa), we end up inconsistent. Wrapping the operation in
--   a plpgsql function gives us a single Postgres transaction.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ambassador_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS ambassador_payout_id uuid REFERENCES ambassador_payouts(id);

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by_paid
  ON profiles(referred_by, ambassador_paid_at);

-- ─── Atomic mark-as-paid RPC ───────────────────────────────────────────
--
-- Called by /api/admin/ambassador-payout when admin clicks "Mark all as
-- paid" on the god-ops dashboard. Returns the payout_id + counts on
-- success, or an error code on failure.
CREATE OR REPLACE FUNCTION mark_ambassador_referrals_paid(
  p_ambassador_id uuid,
  p_tx_signature text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_campaign_slug text;
  v_unpaid_count integer;
  v_payout_usd numeric(10,2);
  v_payout_id uuid;
  v_period_start timestamptz;
  v_now timestamptz := now();
BEGIN
  -- Resolve ambassador → campaign slug
  SELECT campaign_slug INTO v_campaign_slug
    FROM ambassadors
   WHERE id = p_ambassador_id
     AND is_active = true;

  IF v_campaign_slug IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ambassador_not_found');
  END IF;

  -- Count + bound unpaid referrals
  SELECT count(*),
         COALESCE(MIN(ea_claimed_at), v_now)
    INTO v_unpaid_count, v_period_start
    FROM profiles
   WHERE referred_by = v_campaign_slug
     AND ambassador_paid_at IS NULL;

  IF v_unpaid_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_unpaid_referrals');
  END IF;

  v_payout_usd := v_unpaid_count * 0.50;

  -- Insert the payout record
  INSERT INTO ambassador_payouts (
    ambassador_id,
    period_start,
    period_end,
    referral_count,
    payout_usd,
    tx_signature,
    paid_at
  ) VALUES (
    p_ambassador_id,
    v_period_start,
    v_now,
    v_unpaid_count,
    v_payout_usd,
    p_tx_signature,
    v_now
  ) RETURNING id INTO v_payout_id;

  -- Mark every unpaid referral as paid + link back to this payout row
  UPDATE profiles
     SET ambassador_paid_at = v_now,
         ambassador_payout_id = v_payout_id
   WHERE referred_by = v_campaign_slug
     AND ambassador_paid_at IS NULL;

  RETURN jsonb_build_object(
    'ok', true,
    'payout_id', v_payout_id,
    'referral_count', v_unpaid_count,
    'payout_usd', v_payout_usd
  );
END;
$$;
