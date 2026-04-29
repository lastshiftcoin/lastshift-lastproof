import ManageTerminal from "./ManageTerminal";
import { readSession } from "@/lib/session";
import type { Metadata } from "next";

import "./manage.css";

export const metadata: Metadata = {
  title: "Manage Profile -- LASTPROOF",
};

/**
 * /manage — Terminal boot sequence + wallet connect + Terminal ID gate.
 *
 * Ambassador attribution (2026-04-28): no longer captured here. Removed
 * the ?ref= URL param chain and the lp_ref cookie in favor of an
 * explicit "Referred by an operator?" field on the onboarding modal.
 * Street-team operators walk new users through it during onboarding.
 */
export default async function ManagePage() {
  const session = await readSession();
  return <ManageTerminal initialSession={session} />;
}
