import { NextResponse } from "next/server";
import { listAll, __resetStore } from "@/lib/payments-store";

/**
 * Dev-only inspector for the in-memory payments store.
 *
 * GET    → list all payment rows in insertion order
 * DELETE → reset the store (use between test runs)
 *
 * Disabled in production via NODE_ENV check.
 */

function forbidInProd() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, reason: "disabled_in_production" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const blocked = forbidInProd();
  if (blocked) return blocked;
  const rows = await listAll();
  return NextResponse.json({ ok: true, count: rows.length, rows });
}

export async function DELETE() {
  const blocked = forbidInProd();
  if (blocked) return blocked;
  __resetStore();
  return NextResponse.json({ ok: true });
}
