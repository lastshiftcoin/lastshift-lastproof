import { test } from "node:test";
import assert from "node:assert/strict";

const haveEnv =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.LASTPROOF_DB_NOTIFICATIONS === "dual";

const reason = !haveEnv
  ? "skipped: needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + LASTPROOF_DB_NOTIFICATIONS=dual"
  : undefined;

test("notifications dual-write: insert round-trip", { skip: reason }, async () => {
  const { insertNotification, __resetNotifications } = await import(
    "../../src/lib/notifications-store"
  );
  const nDb = await import("../../src/lib/db/notifications-adapter");
  const { supabaseService } = await import("../../src/lib/db/client");
  const sb = supabaseService();

  await nDb.__resetNotificationsDb();
  __resetNotifications();

  const { data: op } = await sb
    .from("operators")
    .insert({ terminal_wallet: "WalletNotif", terminal_id: `SHIFT-NOTI-${Date.now()}` })
    .select()
    .single();
  const { data: pf } = await sb
    .from("profiles")
    .insert({ operator_id: op!.id, handle: `notif_dual_${Date.now()}` })
    .select()
    .single();

  try {
    insertNotification({
      profileId: pf!.id,
      kind: "subscription_warning",
      body: "Subscription expires in 2 days.",
    });
    insertNotification({
      profileId: pf!.id,
      kind: "proof_received",
      body: "New proof received.",
    });

    await new Promise((r) => setTimeout(r, 600));

    const all = await nDb.listNotificationsByProfile(pf!.id);
    assert.equal(all.length, 2);
    assert.ok(all.some((n) => n.kind === "subscription_warning"));
    assert.ok(all.some((n) => n.kind === "proof_received"));
  } finally {
    await nDb.__resetNotificationsDb();
    await sb.from("profiles").delete().eq("id", pf!.id);
    await sb.from("operators").delete().eq("id", op!.id);
  }
});
