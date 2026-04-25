import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { isChadsEnabled } from "@/lib/chads/feature-flag";
import { readSession } from "@/lib/session";
import { getProfileByHandle } from "@/lib/db/profiles-adapter";
import {
  countAcceptedByRequester,
  listAcceptedByRequester,
} from "@/lib/db/chads-adapter";
import { resolveChadProfilesOrdered } from "@/lib/chads/profile-batch";
import { ChadArmyClient } from "@/components/chad/ChadArmyClient";

import "../profile-public.css";

interface PageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  return { title: `Chad Army of @${handle} — LASTPROOF` };
}

/**
 * /@<handle>/chads — public, read-only Chad Army full list.
 *
 * Internal route is /profile/[handle]/chads; the rewrite in next.config.ts
 * maps /@:handle/chads → here.
 *
 * Hidden when feature flag is off (404). Hidden when target is not an
 * active operator (404 — same as `/api/chads/*`).
 */
export default async function PublicChadArmyPage({ params }: PageProps) {
  const session = await readSession();
  if (!isChadsEnabled(session?.walletAddress)) notFound();

  const { handle } = await params;
  const profile = await getProfileByHandle(handle.toLowerCase());
  if (!profile?.terminalWallet || !profile.isPaid || !profile.publishedAt) {
    notFound();
  }

  const targetWallet = profile.terminalWallet;
  // Profile X's public army = chads X has added (directional).
  const armyCount = await countAcceptedByRequester(targetWallet);
  const initialRows = await listAcceptedByRequester(targetWallet);
  const otherWallets = initialRows.map((r) => r.targetWallet);
  const initialItems = await resolveChadProfilesOrdered(otherWallets);
  const initialCursor = initialRows.length > 0 ? initialRows[initialRows.length - 1]!.id : null;

  return (
    <div className="pp-page pp-page-bg pp-chad-army-page">
      <div className="pp-container">
        <div className="chad-army-page-header">
          <Link href={`/@${profile.handle}`} className="chad-army-back">&lt; BACK TO PROFILE</Link>
          <div className="chad-army-eyebrow">&gt; CHAD ARMY · PUBLIC LIST</div>
          <h1 className="chad-army-title">
            CHADS OF <span className="chad-army-handle">@{profile.handle}</span>
          </h1>
          <div className="chad-army-subtitle">{armyCount} ACTIVE CHADS</div>
        </div>

        <ChadArmyClient
          publicHandle={profile.handle}
          initialItems={initialItems}
          initialCursor={initialCursor}
        />
      </div>
    </div>
  );
}
