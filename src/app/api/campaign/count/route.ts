import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/campaign/count
 *
 * Returns the number of profiles that have claimed the free premium upgrade.
 * Used by Popup5000 to check real claim count once the theatrical counter
 * drops below the low-stock threshold (~200).
 *
 * Queries: profiles where ea_claimed = true (column to be added when
 * the claim flow is built). Until then, returns 0 so the popup stays
 * in theatrical mode.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Cache for 60s at the edge — all visitors share the same result
  const headers = {
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
  };

  if (!url || !key) {
    return NextResponse.json({ claimed: 0 }, { headers });
  }

  try {
    const sb = createClient(url, key);
    const { count, error } = await sb
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("ea_claimed", true);

    if (error) {
      // Column doesn't exist yet — return 0
      return NextResponse.json({ claimed: 0 }, { headers });
    }

    return NextResponse.json({ claimed: count ?? 0 }, { headers });
  } catch {
    return NextResponse.json({ claimed: 0 }, { headers });
  }
}
