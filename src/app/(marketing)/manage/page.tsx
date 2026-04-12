import ManageTerminal from "./ManageTerminal";
import { readSession } from "@/lib/session";
import { cookies } from "next/headers";
import type { Metadata } from "next";

import "./manage.css";

export const metadata: Metadata = {
  title: "Manage Profile -- LASTPROOF",
};

/**
 * /manage — Terminal boot sequence + wallet connect + Terminal ID gate.
 *
 * Dual-track referral capture:
 *   Path A: ?ref= URL param → passed as prop to ManageTerminal → carried through
 *           the onboarding flow → sent in campaign claim POST body. Works always.
 *   Path B: ?ref= also set as lp_ref HttpOnly cookie → backup for return visits
 *           where the URL no longer has ?ref=. Blocked by some browsers but
 *           provides redundancy.
 *
 * Attribution: if EITHER source has a valid slug → attribute. Both = same value = 1.
 */
export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const session = await readSession();
  const params = await searchParams;
  const ref = params.ref ?? null;

  // Path B: set backup cookie (best-effort — some browsers block it)
  if (ref) {
    const cookieStore = await cookies();
    cookieStore.set("lp_ref", ref, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
  }

  // Path A: pass ref as prop — always works
  return <ManageTerminal initialSession={session} ref_slug={ref} />;
}
