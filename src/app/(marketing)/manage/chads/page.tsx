import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { isChadsEnabled } from "@/lib/chads/feature-flag";
import { readSession } from "@/lib/session";
import { getProfileByWallet } from "@/lib/chads/resolve-phase";
import {
  countAcceptedForWallet,
  countPendingForTarget,
  listAcceptedForWallet,
  listPendingForTarget,
} from "@/lib/db/chads-adapter";
import { resolveChadProfilesOrdered } from "@/lib/chads/profile-batch";
import { ChadDashboardClient } from "@/components/chad/ChadDashboardClient";

export const metadata: Metadata = {
  title: "Chads — LASTPROOF",
};

/**
 * /manage/chads — the chad management page.
 *
 * The MANAGE → button on the dashboard's ChadManagementStrip lands here.
 * Two stacked InfiniteChadList sections: pending (Accept/Deny) + accepted
 * (Remove). Per locked design: instant Remove, no undo, no confirmation.
 */
export default async function ManageChadsPage() {
  const session = await readSession();
  if (!session) redirect("/manage");
  if (!isChadsEnabled(session.walletAddress)) notFound();

  const wallet = session.walletAddress;
  const profile = await getProfileByWallet(wallet);
  // Owners with no profile or a free profile shouldn't reach this page,
  // but if they do, redirect to /manage to handle onboarding/upgrade.
  if (!profile || !profile.isPaid || !profile.publishedAt) {
    redirect("/manage");
  }

  const [pendingRows, acceptedRows, pendingCount, acceptedCount] = await Promise.all([
    listPendingForTarget(wallet),
    listAcceptedForWallet(wallet),
    countPendingForTarget(wallet),
    countAcceptedForWallet(wallet),
  ]);

  const pendingWallets = pendingRows.map((r) => r.requesterWallet);
  const initialPending = await resolveChadProfilesOrdered(pendingWallets);
  const initialPendingCursor =
    pendingRows.length > 0 ? pendingRows[pendingRows.length - 1]!.id : null;

  const acceptedWallets = acceptedRows.map((r) =>
    r.requesterWallet === wallet ? r.targetWallet : r.requesterWallet,
  );
  const initialAccepted = await resolveChadProfilesOrdered(acceptedWallets);
  const initialAcceptedCursor =
    acceptedRows.length > 0 ? acceptedRows[acceptedRows.length - 1]!.id : null;

  return (
    <div className="pp-page pp-page-bg pp-chad-army-page">
      <div className="pp-container">
        <div className="chad-army-page-header">
          <Link href="/manage/profile" className="chad-army-back">&lt; BACK TO DASHBOARD</Link>
          <div className="chad-army-eyebrow">&gt; CHAD MANAGEMENT</div>
          <h1 className="chad-army-title">
            CHADS OF <span className="chad-army-handle">@{profile.handle}</span>
          </h1>
        </div>

        <ChadDashboardClient
          initialPending={initialPending}
          initialPendingCursor={initialPendingCursor}
          initialAccepted={initialAccepted}
          initialAcceptedCursor={initialAcceptedCursor}
          pendingCount={pendingCount}
          acceptedCount={acceptedCount}
        />
      </div>
    </div>
  );
}
