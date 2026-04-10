import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";

/**
 * GET /api/onboarding/check-handle?handle=foo
 *
 * Returns { available: boolean } after checking the profiles table for
 * an existing handle (case-insensitive).
 *
 * Requires active session.
 */
export async function GET(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const handle = url.searchParams.get("handle")?.toLowerCase().trim();

  if (!handle || handle.length < 3 || handle.length > 20) {
    return NextResponse.json({ available: false });
  }

  // Only allow alphanumeric + underscore
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
    return NextResponse.json({ available: false });
  }

  try {
    const { supabaseService } = await import("@/lib/db/client");
    const { data } = await supabaseService()
      .from("profiles")
      .select("id")
      .ilike("handle", handle)
      .maybeSingle();

    return NextResponse.json({ available: !data });
  } catch (err) {
    console.error("[check-handle] error:", err);
    return NextResponse.json({ available: false });
  }
}
