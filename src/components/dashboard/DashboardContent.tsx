"use client";

/**
 * DashboardContent — the full dashboard editor layout.
 *
 * Renders all edit cards in vertical sequence matching the wireframe:
 * stat quad → tier row → status bar → identity → categories → verified →
 * pitch → proof of work → screenshots → links → about → proofs ledger
 *
 * Each card is a separate component that manages its own save state.
 * Cards are progressively built in Steps 2–12.
 */

import { useState } from "react";
import type { Session } from "@/lib/session";
import type { ProfileRow } from "@/lib/profiles-store";
import { StatQuad } from "./StatQuad";
import { TrustTierRow } from "./TrustTierRow";
import { StatusBar } from "./StatusBar";
import { CampaignFomoStrip } from "./CampaignFomoStrip";
import { IdentityCard } from "./IdentityCard";
import { CategoriesCard } from "./CategoriesCard";
import { VerifiedCard } from "./VerifiedCard";
import { PitchCard } from "./PitchCard";
import { ProofOfWorkCard } from "./ProofOfWorkCard";
import { ScreenshotsCard } from "./ScreenshotsCard";
import { LinksCard } from "./LinksCard";
import { AboutCard } from "./AboutCard";
import { ProofsLedgerCard } from "./ProofsLedgerCard";

interface WorkItemData {
  id: string;
  ticker: string | null;
  role: string;
  description: string | null;
  startedAt: string | null;
  endedAt: string | null;
  minted: boolean;
  proofCount: number;
  hasDevProof: boolean;
  position: number;
}

interface ScreenshotData {
  id: string;
  imageUrl: string;
  linkedUrl: string | null;
  position: number;
}

interface LinkData {
  id: string;
  label: string;
  url: string;
  platform: string;
  pinned: boolean;
  position: number;
}

interface LedgerProofData {
  id: string;
  voucherWallet: string;
  ticker: string | null;
  kind: "proof" | "dev_verification";
  note: string | null;
  txSignature: string | null;
  createdAt: string;
}

interface DashboardContentProps {
  session: Session;
  profile: ProfileRow;
  primaryCategory: string | null;
  additionalCategories: string[];
  workItems: WorkItemData[];
  screenshots: ScreenshotData[];
  links: LinkData[];
  proofs: LedgerProofData[];
  onProfileUpdate: (profile: ProfileRow) => void;
}

export function DashboardContent({ profile, primaryCategory, additionalCategories, workItems, screenshots, links, proofs, onProfileUpdate }: DashboardContentProps) {
  const lastLogin = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const [campaignSoldOut, setCampaignSoldOut] = useState(false);

  return (
    <div className="content">
      {/* Breadcrumb */}
      <div className="crumb">
        {">> "}
        <span className="last">LAST</span>
        <span className="proof">PROOF</span>
        {" // OPERATOR PROFILE"}
      </div>

      {/* Page title */}
      <h1 className="page-h1">
        Build your profile{" "}
        <span style={{
          fontFamily: "var(--mono)",
          fontSize: 9,
          color: "var(--text-dim)",
          letterSpacing: 1.5,
          fontWeight: 400,
          marginLeft: 12,
        }}>
          LAST LOGIN {lastLogin}
        </span>
      </h1>

      {/* ═══ STATUS BAR — first section ═══ */}
      <StatusBar
        profile={profile}
        campaignSoldOut={campaignSoldOut}
        campaignActive={!profile.isPaid}
        onProfileUpdate={onProfileUpdate}
        handle={profile.handle}
      />

      {/* ═══ CAMPAIGN FOMO STRIP — below status bar during 5000 campaign ═══ */}
      {!profile.isPaid && (
        <CampaignFomoStrip onSoldOut={() => setCampaignSoldOut(true)} />
      )}

      {/* ═══ STAT QUAD — Step 2 ═══ */}
      <StatQuad profile={profile} totalProofs={proofs.length} devProofs={proofs.filter(p => p.kind === "dev_verification").length} />

      {/* ═══ TRUST TIER ROW — Step 2 ═══ */}
      <TrustTierRow profile={profile} totalProofs={proofs.length} />

      {/* ═══ IDENTITY — Step 4 ═══ */}
      <IdentityCard
        profile={profile}
        primaryCategory={primaryCategory}
        onProfileUpdate={onProfileUpdate}
      />

      {/* ═══ ADDITIONAL CATEGORIES — Step 5 ═══ */}
      <CategoriesCard
        profile={profile}
        primaryCategory={primaryCategory}
        initialAdditional={additionalCategories}
      />

      {/* ═══ GET VERIFIED — Step 6 ═══ */}
      <VerifiedCard profile={profile} />

      {/* ═══ THE PITCH — Step 7 ═══ */}
      <PitchCard profile={profile} onProfileUpdate={onProfileUpdate} />

      {/* ═══ PROOF OF WORK — Step 8 ═══ */}
      <ProofOfWorkCard initialItems={workItems} />

      {/* ═══ SCREENSHOTS — Step 9 ═══ */}
      <ScreenshotsCard initialShots={screenshots} />

      {/* ═══ LINKS — Step 10 ═══ */}
      <LinksCard initialLinks={links} />

      {/* ═══ ABOUT ME — Step 11 ═══ */}
      <AboutCard profile={profile} onProfileUpdate={onProfileUpdate} />

      {/* ═══ PROOFS LEDGER — Step 12 ═══ */}
      <ProofsLedgerCard proofs={proofs} />
    </div>
  );
}

