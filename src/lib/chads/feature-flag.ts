/**
 * Chad Function — feature flag helpers.
 *
 * Two env switches govern the rollout (see
 * docs/features/chad/DEPLOYMENT-PLAN.md):
 *
 *   CHADS_ENABLED            "true" | other → master kill switch.
 *                            When off, every chad UI surface returns
 *                            null and every /api/chads/* route 404s.
 *
 *   CHADS_ENABLED_WALLETS    Comma-separated wallet allowlist that
 *                            overrides CHADS_ENABLED=false for the
 *                            named wallets. Used during Deploy 2 to
 *                            test the live feature on prod against
 *                            our own wallet without exposing it to
 *                            users.
 *
 * All env reads happen per-call (no boot-time caching) so flipping
 * CHADS_ENABLED in Vercel takes effect on the next request without a
 * redeploy. Vercel reads env at request time for serverless and edge
 * functions; for SSG pages a redeploy is still needed to flush the
 * cached output.
 */

function envIsTrue(name: string): boolean {
  return process.env[name] === "true";
}

function envCsvIncludes(name: string, value: string): boolean {
  const raw = process.env[name];
  if (!raw) return false;
  const lc = value.toLowerCase();
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0)
    .includes(lc);
}

/**
 * Returns true if the chad feature is enabled for this caller.
 *
 * @param wallet  Optional wallet address. When provided, the wallet
 *                allowlist is checked even if CHADS_ENABLED=false —
 *                lets the test wallet exercise the live feature on
 *                prod during Deploy 2. When omitted, only the master
 *                flag is consulted.
 */
export function isChadsEnabled(wallet?: string | null): boolean {
  if (envIsTrue("CHADS_ENABLED")) return true;
  if (wallet && envCsvIncludes("CHADS_ENABLED_WALLETS", wallet)) return true;
  return false;
}

