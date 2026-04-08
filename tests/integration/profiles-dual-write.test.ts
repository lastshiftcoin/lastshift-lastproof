/**
 * Profiles dual-write integration test.
 *
 * Verifies upsertProfileByOperator + updateProfile round-trip to
 * Supabase, including the foreign-table join that resolves
 * `terminalWallet` from the `operators` row on read.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const haveEnv =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.LASTPROOF_DB_PROFILES === "dual";

const reason = !haveEnv
  ? "skipped: needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + LASTPROOF_DB_PROFILES=dual"
  : undefined;

test("profiles dual-write: upsert + update + foreign-table read", { skip: reason }, async () => {
  const { upsertProfileByOperator, updateProfile, __resetProfiles } = await import(
    "../../src/lib/profiles-store"
  );
  const profilesDb = await import("../../src/lib/db/profiles-adapter");
  const { supabaseService } = await import("../../src/lib/db/client");
  const sb = supabaseService();

  await profilesDb.__resetProfilesDb();
  __resetProfiles();

  // Seed operator (FK target). terminal_wallet here is what we expect
  // to read back via the foreign-table join.
  const tw = `WalletProfDual${Date.now()}`;
  const { data: op, error: opErr } = await sb
    .from("operators")
    .insert({ terminal_wallet: tw, terminal_id: `SHIFT-PROF-${Date.now()}` })
    .select()
    .single();
  assert.equal(opErr, null, opErr?.message);

  try {
    const handle = `prof_dual_${Date.now()}`;
    const row = upsertProfileByOperator({
      operatorId: op!.id,
      terminalWallet: tw,
      handle,
      displayName: "Dual Tester",
      isEarlyAdopter: true,
    });

    await new Promise((r) => setTimeout(r, 600));

    const fetched = await profilesDb.getProfileById(row.id);
    assert.ok(fetched, "profile in Supabase");
    assert.equal(fetched!.handle, handle);
    assert.equal(fetched!.displayName, "Dual Tester");
    assert.equal(fetched!.isEarlyAdopter, true);
    assert.equal(fetched!.tier, 5);
    assert.equal(fetched!.terminalWallet, tw, "joined from operators row");

    // Update via the store and verify dual-write propagates the patch.
    updateProfile(row.id, {
      isPaid: true,
      tier: 1,
      subscriptionExpiresAt: "2099-01-01T00:00:00Z",
      publishedAt: "2026-04-08T00:00:00Z",
    });
    await new Promise((r) => setTimeout(r, 500));

    const after = await profilesDb.getProfileById(row.id);
    assert.equal(after!.isPaid, true);
    assert.equal(after!.tier, 1);
    assert.equal(
      new Date(after!.publishedAt!).toISOString(),
      "2026-04-08T00:00:00.000Z",
    );
  } finally {
    await profilesDb.__resetProfilesDb();
    await sb.from("operators").delete().eq("id", op!.id);
  }
});
