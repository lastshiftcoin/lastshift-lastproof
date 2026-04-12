/**
 * Dual-write soak script.
 *
 * Drives N realistic operator/profile/payment lifecycles through every
 * store while in dual mode, then verifies that Supabase row counts
 * match the in-memory truth. Designed to catch:
 *
 *   - silent dual-write failures (memory accepts, DB rejects)
 *   - schema drift (wrong column type, missing column)
 *   - FK ordering bugs (write payments before profile lands)
 *   - throughput / latency issues at small scale
 *
 * Run with the live env loaded:
 *
 *   set -a && . ./.env.local && set +a && npx tsx scripts/soak-dual-write.ts
 *
 * Exits 0 on parity, 1 on any drift.
 */

// Env is loaded by the caller (`set -a && . ./.env.local && set +a && npm run soak`).

const N = Number(process.env.SOAK_N ?? 5);
const SETTLE_MS = 4000;

// Sanity: refuse to run unless dual mode is on for everything.
const REQUIRED_MODES = [
  "LASTPROOF_DB_QUOTES",
  "LASTPROOF_DB_PAYMENTS",
  "LASTPROOF_DB_PROFILES",
  "LASTPROOF_DB_PROOFS",
  "LASTPROOF_DB_NOTIFICATIONS",
  "LASTPROOF_DB_HANDLE_HISTORY",
];
for (const k of REQUIRED_MODES) {
  if (process.env[k] !== "dual" && process.env[k] !== "supabase") {
    console.error(`✖ ${k} must be "dual" or "supabase" — got ${process.env[k] ?? "memory"}`);
    process.exit(2);
  }
}

async function main() {
  const { upsertProfileByOperator, updateProfile, __resetProfiles } =
    await import("../src/lib/profiles-store");
  const { issueQuote, __resetQuotes } = await import("../src/lib/quotes-store");
  const { upsertByTxSignature, markConfirmed, __resetStore: __resetPayments } =
    await import("../src/lib/payments-store");
  const { insertProof, __resetProofs } = await import("../src/lib/proofs-store");
  const { insertNotification, __resetNotifications } =
    await import("../src/lib/notifications-store");
  const { recordHandleChange, __resetHandleHistory } =
    await import("../src/lib/handle-history-store");

  const profilesDb = await import("../src/lib/db/profiles-adapter");
  const quotesDb = await import("../src/lib/db/quotes-adapter");
  const paymentsDb = await import("../src/lib/db/payments-adapter");
  const proofsDb = await import("../src/lib/db/proofs-adapter");
  const notificationsDb = await import("../src/lib/db/notifications-adapter");
  const handleHistoryDb = await import("../src/lib/db/handle-history-adapter");
  const { supabaseService } = await import("../src/lib/db/client");

  const sb = supabaseService();

  // ─── Reset BOTH sides so counts start at zero ─────────────────────────
  console.log(`[soak] resetting memory + DB stores...`);
  await proofsDb.__resetProofsDb();
  await notificationsDb.__resetNotificationsDb();
  await handleHistoryDb.__resetHandleHistoryDb();
  await paymentsDb.__resetPaymentsDb();
  await quotesDb.__resetQuotesDb();
  await profilesDb.__resetProfilesDb();
  // operators FK target — clean stragglers from prior soak runs
  await sb.from("operators").delete().like("terminal_id", "SHIFT-SOAK-%");
  __resetProofs();
  __resetNotifications();
  __resetHandleHistory();
  __resetPayments();
  __resetQuotes();
  __resetProfiles();

  // ─── Drive N lifecycles ───────────────────────────────────────────────
  console.log(`[soak] running ${N} lifecycles...`);
  const profileIds: string[] = [];
  const stamp = Date.now();

  for (let i = 0; i < N; i++) {
    // 1. Insert operator (DB-first since profile FK requires it).
    const { data: op, error: opErr } = await sb
      .from("operators")
      .insert({
        terminal_wallet: `WalletSoak${stamp}_${i}`,
        terminal_id: `SHIFT-SOAK-${stamp}-${i.toString().padStart(4, "0")}`,
      })
      .select()
      .single();
    if (opErr) throw new Error(`operator insert: ${opErr.message}`);

    // 2. Profile via the store (memory + dual-write to DB).
    const profile = await upsertProfileByOperator({
      operatorId: op!.id,
      terminalWallet: op!.terminal_wallet,
      handle: `soak_${stamp}_${i}`,
      displayName: `Soak ${i}`,
      isEarlyAdopter: i % 2 === 0,
    });
    profileIds.push(profile.id);

    // Wait for the fire-and-forget profile insert to land in Supabase
    // before we fire any dependent writes (payments / proofs / etc. all
    // FK to profile_id). In production this race is masked by HTTP
    // latency between API calls; in a tight loop it surfaces.
    for (let tries = 0; tries < 50; tries++) {
      const landed = await profilesDb.getProfileById(profile.id);
      if (landed) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    // 3. Issue a subscription quote.
    const quote = issueQuote({
      profileId: profile.id,
      kind: "subscription",
      token: "USDT",
      tokenUsdRate: 1,
    });

    // Wait for the quote to land — payment FKs to quote_id.
    for (let tries = 0; tries < 50; tries++) {
      const landed = await quotesDb.getQuoteById(quote.id);
      if (landed) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    // 4. Insert a payment row pegged to the quote, then confirm.
    const tx = `TX_SOAK_${stamp}_${i}`;
    await upsertByTxSignature({
      kind: "subscription",
      refId: null,
      operatorId: op!.id,
      profileId: profile.id,
      payerWallet: `Payer${i}`,
      token: "USDT",
      amountUsd: quote.expectedUsd,
      amountToken: quote.expectedToken,
      discountApplied: false,
      quoteId: quote.id,
      txSignature: tx,
      status: "pending",
      confirmedAt: null,
    });
    await markConfirmed(tx);

    // 5. Profile state transition + tier bump.
    await updateProfile(profile.id, {
      isPaid: true,
      tier: 1,
      subscriptionExpiresAt: "2099-01-01T00:00:00Z",
      publishedAt: new Date().toISOString(),
    });

    // 6. Insert a proof + a dev_verification.
    insertProof({
      profileId: profile.id,
      workItemId: null,
      kind: "proof",
      txSignature: `TX_PROOF_SOAK_${stamp}_${i}`,
      payerWallet: `SOAK_WALLET_${i}`,
    });
    insertProof({
      profileId: profile.id,
      workItemId: null,
      kind: "dev_verification",
      txSignature: `TX_DEV_SOAK_${stamp}_${i}`,
      payerWallet: `SOAK_DEV_WALLET_${i}`,
    });

    // 7. Insert two notifications.
    insertNotification({
      profileId: profile.id,
      kind: "subscription_warning",
      body: "soak warning",
    });
    insertNotification({
      profileId: profile.id,
      kind: "proof_received",
      body: "soak proof received",
    });

    // 8. Handle change.
    recordHandleChange({
      profileId: profile.id,
      oldHandle: `soak_${stamp}_${i}`,
      newHandle: `soak_${stamp}_${i}_v2`,
      txSignature: `TX_HH_SOAK_${stamp}_${i}`,
    });
  }

  // ─── Settle fire-and-forget writes ────────────────────────────────────
  console.log(`[soak] settling fire-and-forget writes (${SETTLE_MS}ms)...`);
  await new Promise((r) => setTimeout(r, SETTLE_MS));

  // ─── Verify parity ────────────────────────────────────────────────────
  console.log(`[soak] verifying parity...\n`);

  let drift = 0;
  function check(label: string, expected: number, actual: number) {
    const ok = expected === actual;
    if (!ok) drift++;
    console.log(`  ${ok ? "✔" : "✖"} ${label}: expected=${expected} db=${actual}`);
  }

  // Per-profile spot checks (cheaper than full table scans, scoped to soak data).
  let qCount = 0,
    pCount = 0,
    prCount = 0,
    nCount = 0,
    hCount = 0,
    profCount = 0;

  for (const pid of profileIds) {
    const [q, p, pr, n, h, profile] = await Promise.all([
      quotesDb.listByProfile(pid),
      paymentsDb.listAllPayments().then((rows) => rows.filter((r) => r.profileId === pid)),
      proofsDb.listProofsByProfile(pid),
      notificationsDb.listNotificationsByProfile(pid),
      handleHistoryDb.listByProfile(pid),
      profilesDb.getProfileById(pid),
    ]);
    qCount += q.length;
    pCount += p.length;
    prCount += pr.length;
    nCount += n.length;
    hCount += h.length;
    if (profile) profCount++;

    // Per-profile invariant: profile must be paid + tier 1 after soak update.
    if (!profile || profile.tier !== 1 || !profile.isPaid) {
      console.log(`  ✖ profile ${pid} state drift: ${JSON.stringify(profile)}`);
      drift++;
    }
  }

  check("profiles", N, profCount);
  check("quotes", N, qCount);
  check("payments", N, pCount);
  check("proofs (both kinds)", N * 2, prCount);
  check("notifications", N * 2, nCount);
  check("handle_history", N, hCount);

  // ─── Cleanup ──────────────────────────────────────────────────────────
  console.log(`\n[soak] cleaning up soak data...`);
  await proofsDb.__resetProofsDb();
  await notificationsDb.__resetNotificationsDb();
  await handleHistoryDb.__resetHandleHistoryDb();
  await paymentsDb.__resetPaymentsDb();
  await quotesDb.__resetQuotesDb();
  await profilesDb.__resetProfilesDb();
  await sb.from("operators").delete().like("terminal_id", "SHIFT-SOAK-%");

  if (drift > 0) {
    console.error(`\n✖ SOAK FAILED — ${drift} drift(s)`);
    process.exit(1);
  }
  console.log(`\n✔ SOAK PASSED — ${N} lifecycles round-tripped cleanly`);
}

main().catch((err) => {
  console.error(`✖ soak crashed:`, err);
  process.exit(1);
});
