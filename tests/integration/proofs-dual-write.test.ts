/**
 * Proofs dual-write integration test.
 *
 * Verifies insertProof for both kinds (proof + dev_verification)
 * round-trips into the `proofs` table after migration 0002.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const haveEnv =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.LASTPROOF_DB_PROOFS === "dual";

const reason = !haveEnv
  ? "skipped: needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + LASTPROOF_DB_PROOFS=dual"
  : undefined;

test("proofs dual-write: proof + dev_verification round-trip", { skip: reason }, async () => {
  const { insertProof, __resetProofs } = await import("../../src/lib/proofs-store");
  const proofsDb = await import("../../src/lib/db/proofs-adapter");
  const { supabaseService } = await import("../../src/lib/db/client");
  const sb = supabaseService();

  await proofsDb.__resetProofsDb();
  __resetProofs();

  const { data: op } = await sb
    .from("operators")
    .insert({ terminal_wallet: "WalletProof", terminal_id: `SHIFT-PROOF-${Date.now()}` })
    .select()
    .single();
  const { data: pf } = await sb
    .from("profiles")
    .insert({ operator_id: op!.id, handle: `proof_dual_${Date.now()}` })
    .select()
    .single();

  try {
    insertProof({
      profileId: pf!.id,
      workItemId: null,
      kind: "proof",
      txSignature: `TX_PROOF_${Date.now()}`,
      payerWallet: "TEST_PAYER_WALLET",
    });
    insertProof({
      profileId: pf!.id,
      workItemId: null,
      kind: "dev_verification",
      txSignature: `TX_DEV_${Date.now()}`,
      payerWallet: "TEST_DEV_PAYER_WALLET",
    });

    await new Promise((r) => setTimeout(r, 700));

    const all = await proofsDb.listProofsByProfile(pf!.id);
    assert.equal(all.length, 2);
    const proofCount = await proofsDb.countProofsByProfile(pf!.id, "proof");
    const devCount = await proofsDb.countProofsByProfile(pf!.id, "dev_verification");
    assert.equal(proofCount, 1);
    assert.equal(devCount, 1);
  } finally {
    await proofsDb.__resetProofsDb();
    await sb.from("profiles").delete().eq("id", pf!.id);
    await sb.from("operators").delete().eq("id", op!.id);
  }
});
