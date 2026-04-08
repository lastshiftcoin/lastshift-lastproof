/**
 * Supabase clients — server-only.
 *
 * Two singletons:
 *   - supabaseService: SERVICE_ROLE key, bypasses RLS, used by ALL server
 *     routes for writes. Never expose to the browser.
 *   - supabaseAnon:    ANON key, RLS-enforced, used for read-only queries
 *     against the public_profiles / public_profiles_expired views from
 *     server routes that want to honor public visibility rules.
 *
 * Both are lazy — they throw at first use (not import time) if env is
 * missing, so tests and tools that don't touch the DB can still import
 * modules that touch this file.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _service: SupabaseClient | null = null;
let _anon: SupabaseClient | null = null;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[db] missing env: ${name}`);
  return v;
}

export function supabaseService(): SupabaseClient {
  if (_service) return _service;
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  _service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-tool": "lastproof" } },
  });
  return _service;
}

export function supabaseAnon(): SupabaseClient {
  if (_anon) return _anon;
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  _anon = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _anon;
}

/** Test-only: clear singletons so a fresh env can take effect. */
export function __resetDbClients(): void {
  _service = null;
  _anon = null;
}
