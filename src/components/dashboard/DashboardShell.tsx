"use client";

/**
 * DashboardShell — decides between onboarding modal and full dashboard.
 *
 * If no profile exists → show OnboardingModal overlay.
 * If profile exists → show the full dashboard editor.
 *
 * After onboarding completes, it creates the profile and reloads the page
 * so the server component re-fetches fresh data.
 */

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { Session } from "@/lib/session";
import type { ProfileRow } from "@/lib/profiles-store";
import { OnboardingModal } from "./OnboardingModal";
import { DashboardContent } from "./DashboardContent";

interface DashboardShellProps {
  session: Session;
  initialProfile: ProfileRow | null;
  operatorId: string | null;
  primaryCategory: string | null;
  additionalCategories: string[];
  workItems: Array<{
    id: string; ticker: string | null; role: string; description: string | null;
    startedAt: string | null; endedAt: string | null; minted: boolean;
    proofCount: number; hasDevProof: boolean; position: number;
  }>;
  screenshots: Array<{
    id: string; imageUrl: string; linkedUrl: string | null; position: number;
  }>;
  links: Array<{
    id: string; label: string; url: string; platform: string; pinned: boolean; position: number;
  }>;
  proofs: Array<{
    id: string; voucherWallet: string; ticker: string | null;
    kind: "proof" | "dev_verification"; note: string | null;
    txSignature: string | null; createdAt: string;
  }>;
  previousHandles: string[];
}

export function DashboardShell({ session, initialProfile, operatorId, primaryCategory, additionalCategories, workItems, screenshots, links, proofs, previousHandles }: DashboardShellProps) {
  const [profile, setProfile] = useState(initialProfile);
  const { disconnect } = useWallet();

  const handleDisconnect = useCallback(async () => {
    // Clear session cookie, disconnect wallet, redirect to /manage
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
    await disconnect().catch(() => {});
    window.location.href = "/manage";
  }, [disconnect]);

  // New user — no profile yet → show onboarding
  if (!profile) {
    if (!operatorId) {
      // Edge case: session exists but no operator row — shouldn't happen, redirect
      return (
        <div className="content" style={{ textAlign: "center", paddingTop: 80 }}>
          <div style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "var(--text-dim)",
            letterSpacing: 1,
          }}>
            No operator record found. Please disconnect and reconnect.
          </div>
        </div>
      );
    }

    return (
      <OnboardingModal
        session={session}
        operatorId={operatorId}
        onComplete={setProfile}
        onDisconnect={handleDisconnect}
      />
    );
  }

  // Returning user — show full dashboard
  return (
    <DashboardContent
      session={session}
      profile={profile}
      primaryCategory={primaryCategory}
      additionalCategories={additionalCategories}
      workItems={workItems}
      screenshots={screenshots}
      links={links}
      proofs={proofs}
      previousHandles={previousHandles}
      onProfileUpdate={setProfile}
    />
  );
}
