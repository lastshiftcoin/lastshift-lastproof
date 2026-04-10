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
 * Wireframes: manage-profile.html, manage-profile-dashboard-entry.html,
 *             manage-profile-no-terminal.html
 *
 * If the user already has a valid session cookie, ManageTerminal skips
 * the boot animation and shows the "ACCESS GRANTED" state directly.
 */
export default async function ManagePage() {
  const session = await readSession();
  return <ManageTerminal initialSession={session} />;
}
