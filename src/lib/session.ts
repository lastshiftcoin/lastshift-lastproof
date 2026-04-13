/**
 * Session layer — thin cookie-backed session for the validate skeleton.
 *
 * v1 stores session state in a signed HttpOnly cookie (`lp_session`) so we can
 * wire the full validate round-trip without depending on Supabase yet. When
 * `session_tokens` lands in the DB, swap `writeSession` / `readSession` to
 * persist there and keep the same public API.
 *
 * Session payload mirrors the non-sensitive subset of ValidateSuccess that the
 * rest of LASTPROOF needs to make authorization decisions. Secrets / bearer
 * tokens never go in the cookie.
 */

import { cookies } from "next/headers";
import crypto from "node:crypto";
import type { SubscriptionStatus } from "./terminal-client";

export interface Session {
  walletAddress: string;
  terminalId: string;
  firstFiveThousand: boolean;
  freeSubUntil: string | null;
  subscriptionStatus: SubscriptionStatus;
  verified: { x: boolean; telegram: boolean };
  displayName: string | null;
  issuedAt: number; // epoch ms
}

const COOKIE_NAME = "lp_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h soft — validate still re-checks on gated actions

function getSecret(): string {
  // SESSION_HMAC_SECRET is the dedicated session signing key.
  // Falls back to INTER_TOOL_API_SECRET for backward compatibility,
  // but production MUST set SESSION_HMAC_SECRET independently so
  // compromising the inter-tool secret doesn't compromise user sessions.
  const s = process.env.SESSION_HMAC_SECRET || process.env.INTER_TOOL_API_SECRET;
  if (!s) throw new Error("SESSION_HMAC_SECRET (or INTER_TOOL_API_SECRET fallback) not set");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function encode(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

function decode(raw: string): Session | null {
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  // timing-safe compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (!parsed.issuedAt || Date.now() - parsed.issuedAt > SESSION_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeSession(session: Omit<Session, "issuedAt">): Promise<void> {
  const full: Session = { ...session, issuedAt: Date.now() };
  const jar = await cookies();
  jar.set(COOKIE_NAME, encode(full), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return decode(raw);
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
