/**
 * Terminal S2S bridge smoke test.
 *
 * Exercises the LASTPROOF → Terminal contract end-to-end against a real
 * running Terminal dev server. Every assertion is field-by-field against
 * HANDOFF-LASTPROOF-ANSWERS.md — any delta is a Terminal-side bug by
 * prior agreement.
 *
 * Preconditions (documented in docs/TERMINAL-BRIDGE-SMOKE.md):
 *   1. terminal-build dev server running on TERMINAL_API_URL (default :3000)
 *   2. schema-v3-lastproof.sql migration applied to Terminal Supabase
 *   3. INTER_TOOL_API_SECRET set in lastproof-build/.env.local,
 *      identical to the value in terminal-build/.env.local
 *   4. Seed row present: TEST1111111111111111111111111111111111111111 /
 *      SHIFT-TEST-0001-0001-0001 / first_five_thousand=true /
 *      free_sub_until=2026-06-07T00:00:00Z
 *
 * Run:
 *   set -a && . ./.env.local && set +a && tsx scripts/terminal-bridge-smoke.ts
 *
 * Exit code 0 on green, 1 on any drift.
 */

import {
  validateTerminalId,
  confirmAffiliate,
  invalidateValidateCache,
  type ValidateResult,
  type AffiliateConfirmResult,
} from "../src/lib/terminal-client";

const SEED_WALLET = "TEST1111111111111111111111111111111111111111";
const SEED_TID = "SHIFT-TEST-0001-0001-0001";
const SEED_FREE_SUB_UNTIL = "2026-06-07T00:00:00+00:00"; // Postgres timestamptz render
const SEED_FREE_SUB_UNTIL_ALT = "2026-06-07T00:00:00Z"; // client-side render

interface Case {
  name: string;
  run: () => Promise<string[]>; // returns drift list (empty = pass)
}

function driftEq<T>(
  field: string,
  actual: T,
  expected: T | ((v: T) => boolean),
): string | null {
  if (typeof expected === "function") {
    const pred = expected as (v: T) => boolean;
    return pred(actual) ? null : `${field} failed predicate (got ${JSON.stringify(actual)})`;
  }
  if (actual === expected) return null;
  return `${field} expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`;
}

function collect(...maybes: Array<string | null>): string[] {
  return maybes.filter((x): x is string => x !== null);
}

const cases: Case[] = [
  {
    name: "validate: happy path returns canonical success shape",
    run: async () => {
      invalidateValidateCache();
      const r: ValidateResult = await validateTerminalId(SEED_WALLET, SEED_TID, {
        skipCache: true,
      });
      if (!r.valid) {
        return [`expected valid=true, got ${r.reason} (HTTP ${r.httpStatus}): ${r.message}`];
      }
      // Normalize timestamptz for comparison — accept either "Z" or "+00:00".
      const freeSub = r.freeSubUntil
        ? new Date(r.freeSubUntil).toISOString()
        : null;
      return collect(
        driftEq("walletAddress", r.walletAddress, SEED_WALLET),
        driftEq("terminalId", r.terminalId, SEED_TID),
        driftEq("firstFiveThousand", r.firstFiveThousand, true),
        driftEq(
          "freeSubUntil (normalized)",
          freeSub,
          new Date(SEED_FREE_SUB_UNTIL_ALT).toISOString(),
        ),
        driftEq("subscriptionStatus", r.subscriptionStatus, "free_ea"),
        driftEq("verified.x", r.verified?.x, false),
        driftEq("verified.telegram", r.verified?.telegram, false),
        driftEq("displayName", r.displayName, "test-operator"),
        driftEq("createdAt is string", typeof r.createdAt, "string"),
      );
    },
  },
  {
    name: "validate: unknown wallet returns wallet_not_registered 404",
    run: async () => {
      invalidateValidateCache();
      const r = await validateTerminalId(
        "NONEXISTENT1111111111111111111111111111111111",
        SEED_TID,
        { skipCache: true },
      );
      if (r.valid) return ["expected valid=false, got success"];
      return collect(
        driftEq("reason", r.reason, "wallet_not_registered"),
        driftEq("httpStatus", r.httpStatus, 404),
      );
    },
  },
  {
    name: "validate: wrong TID for known wallet returns wallet_tid_mismatch 403",
    run: async () => {
      invalidateValidateCache();
      const r = await validateTerminalId(
        SEED_WALLET,
        "SHIFT-WRNG-9999-9999-9999",
        { skipCache: true },
      );
      if (r.valid) return ["expected valid=false, got success"];
      return collect(
        driftEq("reason", r.reason, "wallet_tid_mismatch"),
        driftEq("httpStatus", r.httpStatus, 403),
      );
    },
  },
  {
    name: "validate: malformed body returns malformed_request 400",
    run: async () => {
      // Direct fetch — the typed client won't let us send a malformed body.
      const base = process.env.TERMINAL_API_URL!;
      const secret = process.env.INTER_TOOL_API_SECRET!;
      const res = await fetch(`${base}/api/license/validate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "X-LastShift-Key-Id": "v1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ walletAddress: SEED_WALLET }), // missing terminalId + toolSlug
      });
      const body = (await res.json()) as { valid?: boolean; reason?: string };
      return collect(
        driftEq("httpStatus", res.status, 400),
        driftEq("valid", body.valid, false),
        driftEq("reason", body.reason, "malformed_request"),
      );
    },
  },
  {
    name: "validate: bad bearer returns 401 unauthorized",
    run: async () => {
      const base = process.env.TERMINAL_API_URL!;
      const res = await fetch(`${base}/api/license/validate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer WRONG_SECRET_VALUE`,
          "X-LastShift-Key-Id": "v1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: SEED_WALLET,
          terminalId: SEED_TID,
          toolSlug: "lastproof",
        }),
      });
      return collect(driftEq("httpStatus", res.status, 401));
    },
  },
  {
    name: "validate: missing X-LastShift-Key-Id returns 401",
    run: async () => {
      const base = process.env.TERMINAL_API_URL!;
      const secret = process.env.INTER_TOOL_API_SECRET!;
      const res = await fetch(`${base}/api/license/validate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: SEED_WALLET,
          terminalId: SEED_TID,
          toolSlug: "lastproof",
        }),
      });
      return collect(driftEq("httpStatus", res.status, 401));
    },
  },
  {
    name: "validate: unknown toolSlug returns tool_not_entitled 403",
    run: async () => {
      invalidateValidateCache();
      // Temporarily override TOOL_SLUG via env — client reads lazily.
      const prev = process.env.TOOL_SLUG;
      process.env.TOOL_SLUG = "nonexistent_tool";
      try {
        const r = await validateTerminalId(SEED_WALLET, SEED_TID, {
          skipCache: true,
        });
        if (r.valid) return ["expected valid=false, got success"];
        return collect(
          driftEq("reason", r.reason, "tool_not_entitled"),
          driftEq("httpStatus", r.httpStatus, 403),
        );
      } finally {
        process.env.TOOL_SLUG = prev;
      }
    },
  },
  {
    name: "affiliate confirm: unreferred wallet returns no_affiliate_on_record",
    run: async () => {
      const r: AffiliateConfirmResult = await confirmAffiliate({
        wallet: SEED_WALLET,
        terminalId: SEED_TID,
        profileUrl: "https://lastproof.app/@test-operator",
      });
      if (!r.ok) {
        return [`expected ok=true, got ok=false reason=${r.reason}: ${r.message}`];
      }
      return collect(
        driftEq("credited", r.credited, false),
        driftEq("reason", r.reason, "no_affiliate_on_record" as typeof r.reason),
      );
    },
  },
  {
    name: "affiliate confirm: wallet_tid_mismatch returns 403",
    run: async () => {
      const r = await confirmAffiliate({
        wallet: SEED_WALLET,
        terminalId: "SHIFT-WRNG-9999-9999-9999",
        profileUrl: "https://lastproof.app/@test-operator",
      });
      if (r.ok) return ["expected ok=false, got ok=true"];
      return collect(
        driftEq("reason", r.reason, "wallet_tid_mismatch"),
        driftEq("httpStatus", r.httpStatus, 403),
      );
    },
  },
  {
    name: "affiliate confirm: unknown wallet returns 404 wallet_not_registered",
    run: async () => {
      const r = await confirmAffiliate({
        wallet: "NONEXISTENT1111111111111111111111111111111111",
        terminalId: SEED_TID,
        profileUrl: "https://lastproof.app/@ghost",
      });
      if (r.ok) return ["expected ok=false, got ok=true"];
      return collect(
        driftEq("reason", r.reason, "wallet_not_registered"),
        driftEq("httpStatus", r.httpStatus, 404),
      );
    },
  },
];

async function main() {
  const base = process.env.TERMINAL_API_URL;
  const secret = process.env.INTER_TOOL_API_SECRET;
  if (!base || !secret) {
    console.error("❌ TERMINAL_API_URL and INTER_TOOL_API_SECRET must be set.");
    process.exit(2);
  }

  console.log(`[smoke] Terminal bridge — target ${base}`);
  console.log(`[smoke] test row: ${SEED_WALLET} / ${SEED_TID}`);
  console.log("");

  let failures = 0;
  for (const c of cases) {
    process.stdout.write(`  • ${c.name} ... `);
    try {
      const drift = await c.run();
      if (drift.length === 0) {
        console.log("✅");
      } else {
        console.log("❌");
        for (const d of drift) console.log(`      - ${d}`);
        failures++;
      }
    } catch (err) {
      console.log("💥");
      console.log(`      - threw: ${(err as Error).message}`);
      failures++;
    }
  }

  console.log("");
  if (failures === 0) {
    console.log("✅ SMOKE PASSED — Terminal bridge matches contract");
    process.exit(0);
  } else {
    console.log(`❌ SMOKE FAILED — ${failures} case(s) drifted from contract`);
    console.log("   File one issue per delta; Terminal-side bugs by default.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("smoke script crashed:", err);
  process.exit(2);
});
