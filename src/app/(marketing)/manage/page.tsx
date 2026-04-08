import ManageGate from "./ManageGate";
import { readSession } from "@/lib/session";

/**
 * /manage — skeleton entry point for the Terminal ID gate.
 *
 * Real design lives in the wireframes (Phase D). This page exists now so the
 * Terminal validate round-trip has somewhere to land while the identity bridge
 * is skeletoned. When the wireframed manage flow arrives, we replace the
 * markup below with the real shell; `ManageGate` + the API routes stay.
 */
export default async function ManagePage() {
  const session = await readSession();
  return <ManageGate initialSession={session} />;
}
