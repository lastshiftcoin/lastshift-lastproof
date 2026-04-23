import { NextResponse } from "next/server";
import { readSession, clearSession } from "@/lib/session";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, session });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
