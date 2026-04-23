import { test } from "node:test";
import assert from "node:assert/strict";

const haveEnv =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.LASTPROOF_DB_HANDLE_HISTORY === "dual";

const reason = !haveEnv
  ? "skipped: needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + LASTPROOF_DB_HANDLE_HISTORY=dual"
  : undefined;

test("handle_history dual-write: round-trip", { skip: reason }, async () => {
  const { recordHandleChange, __resetHandleHistory } = await import(
    "../../src/lib/handle-history-store"
  );
  const hDb = await import("../../src/lib/db/handle-history-adapter");
  const { supabaseService } = await import("../../src/lib/db/client");
  const sb = supabaseService();

  await hDb.__resetHandleHistoryDb();
  __resetHandleHistory();

  const { data: op } = await sb
    .from("operators")
    .insert({ terminal_wallet: "WalletHH", terminal_id: `SHIFT-HH-${Date.now()}` })
    .select()
    .single();
  const { data: pf } = await sb
    .from("profiles")
    .insert({ operator_id: op!.id, handle: `hh_dual_${Date.now()}` })
    .select()
    .single();

  try {
    recordHandleChange({
      profileId: pf!.id,
      oldHandle: "old_one",
      newHandle: "new_one",
      txSignature: "TX_HH_1",
    });
    recordHandleChange({
      profileId: pf!.id,
      oldHandle: "new_one",
      newHandle: "new_two",
      txSignature: null,
    });

    await new Promise((r) => setTimeout(r, 600));

    const all = await hDb.listByProfile(pf!.id);
    assert.equal(all.length, 2);
    assert.equal(all[0].oldHandle, "old_one");
    assert.equal(all[1].newHandle, "new_two");
    assert.equal(all[1].txSignature, null);
  } finally {
    await hDb.__resetHandleHistoryDb();
    await sb.from("profiles").delete().eq("id", pf!.id);
    await sb.from("operators").delete().eq("id", op!.id);
  }
});
