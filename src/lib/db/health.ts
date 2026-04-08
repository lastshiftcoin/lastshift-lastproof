/**
 * DB health probe — used by /api/health and boot scripts to confirm
 * the service-role client can reach Supabase before flipping any store
 * mode to "dual" or "supabase".
 */

import { supabaseService } from "./client";
import { getAllStoreModes } from "./mode";

export interface DbHealth {
  ok: boolean;
  reachable: boolean;
  latencyMs: number | null;
  error: string | null;
  modes: ReturnType<typeof getAllStoreModes>;
}

export async function probeDb(): Promise<DbHealth> {
  const modes = getAllStoreModes();
  const start = Date.now();
  try {
    // Cheapest possible round-trip: count(*) on a tiny lookup table.
    const { error } = await supabaseService()
      .from("categories")
      .select("slug", { count: "exact", head: true });
    const latencyMs = Date.now() - start;
    if (error) {
      return { ok: false, reachable: false, latencyMs, error: error.message, modes };
    }
    return { ok: true, reachable: true, latencyMs, error: null, modes };
  } catch (err) {
    return {
      ok: false,
      reachable: false,
      latencyMs: null,
      error: (err as Error).message,
      modes,
    };
  }
}
