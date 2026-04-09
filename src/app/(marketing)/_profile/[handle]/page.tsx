import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { cryptomarkProfile } from "@/lib/mock/cryptomark-profile";
import type { PublicProfileView, WorkItem } from "@/lib/public-profile-view";

import { ProfileHero } from "@/components/profile/ProfileHero";
import { TrustTierBar } from "@/components/profile/TrustTierBar";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { StatStrip } from "@/components/profile/StatStrip";
import { CategoryChips } from "@/components/profile/CategoryChips";
import { WorkItemCard } from "@/components/profile/WorkItemCard";
import { ScreenshotGrid } from "@/components/profile/ScreenshotGrid";
import { ProfileLinksList } from "@/components/profile/ProfileLinksList";
import { ProofsTable } from "@/components/profile/ProofsTable";
import { CtaStrip } from "@/components/profile/CtaStrip";

import "./profile-public.css";

interface PageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle} — LASTPROOF` };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { handle } = await params;

  // Step 1: single mock. Real projector fan-out lands in Step 3.
  if (handle !== "cryptomark") notFound();
  const view: PublicProfileView = cryptomarkProfile;

  const mintedItems = view.workItems.filter((w) => w.section === "minted");
  const recentItems = view.workItems.filter((w) => w.section === "recent");
  // Wireframe literally says "SEE 43 PAST PROJECTS →" even though
  // 50 − 8 = 42. Mirroring verbatim per handoff §6 #4.
  const pastProjectsCount = 43;

  return (
    <div className="pp-page pp-page-bg">
      <div className="pp-container">
        <ProfileHero
          handle={view.handle}
          displayName={view.displayName}
          avatarUrl={view.avatarUrl}
          avatarMonogram={view.avatarMonogram}
          statusLabel={view.statusLabel}
          isEarlyAdopter={view.isEarlyAdopter}
          isVerified={view.isVerified}
          headline={view.headline}
          timezone={view.timezone}
          language={view.language}
          feeRange={view.feeRange}
          xHandle={view.xHandle}
          tgHandle={view.tgHandle}
          website={view.website}
          hireTelegramHandle={view.hireTelegramHandle}
        />

        <TrustTierBar
          tier={view.tier}
          tierBarFillPct={view.tierBarFillPct}
          tierSubtitle={view.tierSubtitle}
        />

        <ProfileTabs active="overview" />

        <StatStrip
          proofsConfirmed={view.proofsConfirmed}
          devProofsConfirmed={view.devProofsConfirmed}
          projectsCount={view.projectsCount}
          feeRange={view.feeRange}
        />

        <CategoryChips categories={view.categories} />

        {/* ═══ THE PITCH ═══ */}
        <section className="pp-section">
          <h2 className="pp-section-title">THE PITCH</h2>
          <div className="pp-pitch-body">
            {view.pitchBody.split("\n\n").map((p: string, i: number) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        {/* ═══ PROOF OF WORK ═══ */}
        <section className="pp-section">
          <h2 className="pp-section-title">
            PROOF OF WORK
            <span className="pp-count">
              {view.workItems.length} SHOWN · {view.totalWorkItems} TOTAL
            </span>
          </h2>

          {mintedItems.length > 0 && (
            <>
              <div className="pp-pow-section-label">MINTED PROJECTS</div>
              {mintedItems.map((w: WorkItem) => (
                <WorkItemCard key={w.id} item={w} />
              ))}
            </>
          )}

          {recentItems.length > 0 && (
            <>
              <div className="pp-pow-section-label pp-recent">RECENT</div>
              {recentItems.map((w: WorkItem) => (
                <WorkItemCard key={w.id} item={w} />
              ))}
            </>
          )}

          <a className="pp-pow-archive">SEE {pastProjectsCount} PAST PROJECTS →</a>
        </section>

        {/* ═══ SCREENSHOTS ═══ */}
        <section className="pp-section">
          <h2 className="pp-section-title">
            SCREENSHOTS
            <span className="pp-count">{view.totalScreenshots} SHOTS</span>
          </h2>
          <ScreenshotGrid screenshots={view.screenshots} />
        </section>

        {/* ═══ LINKS ═══ */}
        <section className="pp-section">
          <h2 className="pp-section-title">
            LINKS
            <span className="pp-count">
              {view.pinnedLinksCount} PINNED · {view.totalLinks} TOTAL
            </span>
          </h2>
          <ProfileLinksList
            links={view.profileLinks}
            totalLinks={view.totalLinks}
            pinnedLinksCount={view.pinnedLinksCount}
          />
        </section>

        {/* ═══ ABOUT ME ═══ */}
        <section className="pp-section">
          <h2 className="pp-section-title">ABOUT ME</h2>
          <p className="pp-about-body">{view.about}</p>
          <div className="pp-aliases">
            <span className="pp-key">PREVIOUSLY KNOWN AS:</span>
            <span className="pp-alias-chip">@CryptoMarkOG</span>
            <span className="pp-alias-chip">@MarkTheShiller</span>
          </div>
        </section>

        {/* ═══ VERIFICATIONS ═══ */}
        <section className="pp-section">
          <h2 className="pp-section-title">
            VERIFICATIONS
            <span className="pp-count">{view.recentProofs.length} OF {view.totalProofs}</span>
          </h2>
          <ProofsTable proofs={view.recentProofs} totalProofs={view.totalProofs} />
        </section>

        <CtaStrip />
      </div>
    </div>
  );
}
