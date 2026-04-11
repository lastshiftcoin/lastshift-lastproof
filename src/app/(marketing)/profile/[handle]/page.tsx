import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getPublicProfileView } from "@/lib/projector/public-profile";
import { readSession } from "@/lib/session";
import { getProfileByHandle, incrementViewCount } from "@/lib/db/profiles-adapter";
import { cryptomarkProfile } from "@/lib/mock/cryptomark-profile";
import { shipfastProfile } from "@/lib/mock/shipfast-profile";
import { newbuilderProfile } from "@/lib/mock/newbuilder-profile";
import type { PublicProfileView, WorkItem } from "@/lib/public-profile-view";

import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileTopBar } from "@/components/profile/ProfileTopBar";
import { LegendCtaSwitch } from "@/components/profile/LegendCtaSwitch";
import { TrustTierBar } from "@/components/profile/TrustTierBar";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { StatStrip } from "@/components/profile/StatStrip";
import { CategoryChips } from "@/components/profile/CategoryChips";
import { WorkItemCard } from "@/components/profile/WorkItemCard";
import { ScreenshotGrid } from "@/components/profile/ScreenshotGrid";
import { ProfileLinksList } from "@/components/profile/ProfileLinksList";
import { ProofsTable } from "@/components/profile/ProofsTable";
import { CtaStrip } from "@/components/profile/CtaStrip";
import { PreviewBanner } from "@/components/profile/PreviewBanner";

import "./profile-public.css";

interface PageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle} — LASTPROOF` };
}

/**
 * Mock fixtures — used when a handle doesn't exist in Supabase yet.
 * Once the dashboard can create real profiles, remove the fallback.
 */
const FIXTURES: Record<string, PublicProfileView> = {
  cryptomark: cryptomarkProfile,
  shipfast: shipfastProfile,
  newbuilder: newbuilderProfile,
};

export default async function PublicProfilePage({ params, searchParams }: PageProps) {
  const { handle } = await params;
  const sp = await searchParams;
  const wantsPreview = sp.preview === "true";

  // Auth-gate preview: only the profile owner can see preview mode
  let isPreview = false;
  if (wantsPreview) {
    const session = await readSession();
    if (session) {
      const profile = await getProfileByHandle(handle);
      // operatorId is a UUID; walletAddress is a Solana pubkey.
      // Match via terminalWallet which equals session.walletAddress.
      if (profile && profile.terminalWallet === session.walletAddress) {
        isPreview = true;
      }
    }
  }

  // Try the real projector first (reads Supabase), fall back to mock fixtures.
  const view = (await getPublicProfileView(handle, { previewMode: isPreview })) ?? FIXTURES[handle] ?? null;
  if (!view) notFound();

  // Increment view count for non-owner visitors (fire-and-forget)
  if (!isPreview) {
    const session = await readSession();
    const isOwner = session && view.ownerWallet === session.walletAddress;
    if (!isOwner) {
      incrementViewCount(handle).catch(() => {});
    }
  }

  // ─── FREE variant: stripped layout (hero + CTA only) ──────────
  if (view.variant === "free") {
    return (
      <div className="pp-page pp-page-bg">
        <div className="pp-container">
          {isPreview && <PreviewBanner handle={view.handle} />}
          <ProfileTopBar handle={view.handle} />
          <ProfileHero
            variant="free"
            handle={view.handle}
            displayName={view.displayName}
            avatarUrl={view.avatarUrl}
            avatarMonogram={view.avatarMonogram}
            statusLabel={view.statusLabel}
            isEarlyAdopter={view.isEarlyAdopter}
            earlyAdopterNumber={view.earlyAdopterNumber}
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
          <CtaStrip variant="free" />
        </div>
      </div>
    );
  }

  const mintedItems = view.workItems.filter((w) => w.section === "minted");
  const recentItems = view.workItems.filter((w) => w.section === "recent");
  // Wireframe literally says "SEE 43 PAST PROJECTS →" even though
  // 50 − 8 = 42. Mirroring verbatim per handoff §6 #4.
  const pastProjectsCount = 43;

  return (
    <div className="pp-page pp-page-bg">
      <div className="pp-container">
        {isPreview && <PreviewBanner handle={view.handle} />}
        <ProfileTopBar handle={view.handle} />
        <ProfileHero
          variant={view.variant}
          handle={view.handle}
          displayName={view.displayName}
          avatarUrl={view.avatarUrl}
          avatarMonogram={view.avatarMonogram}
          statusLabel={view.statusLabel}
          isEarlyAdopter={view.isEarlyAdopter}
          earlyAdopterNumber={view.earlyAdopterNumber}
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

        <div data-pane="overview">
          <StatStrip
            proofsConfirmed={view.proofsConfirmed}
            devProofsConfirmed={view.devProofsConfirmed}
            projectsCount={view.projectsCount}
            feeRange={view.feeRange}
          />

          <CategoryChips categories={view.categories} />
        </div>

        {/* ═══ THE PITCH ═══ */}
        <section className="pp-section" data-pane="pitch">
          <h2 className="pp-section-title">THE PITCH</h2>
          <div className="pp-pitch-body">
            {view.pitchBody.split("\n\n").map((p: string, i: number) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        {/* ═══ PROOF OF WORK ═══ */}
        <section className="pp-section" data-pane="pow">
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
                <WorkItemCard key={w.id} item={w} handle={view.handle} ownerWallet={view.ownerWallet} />
              ))}
            </>
          )}

          {recentItems.length > 0 && (
            <>
              <div className="pp-pow-section-label pp-recent">RECENT</div>
              {recentItems.map((w: WorkItem) => (
                <WorkItemCard key={w.id} item={w} handle={view.handle} ownerWallet={view.ownerWallet} />
              ))}
            </>
          )}

          <a className="pp-pow-archive">SEE {pastProjectsCount} PAST PROJECTS →</a>
        </section>

        {/* ═══ SCREENSHOTS ═══ */}
        <section className="pp-section" data-pane="shots">
          <h2 className="pp-section-title">
            SCREENSHOTS
            <span className="pp-count">{view.totalScreenshots} UPLOADED</span>
          </h2>
          <ScreenshotGrid screenshots={view.screenshots} />
        </section>

        {/* ═══ LINKS ═══ */}
        <section className="pp-section" data-pane="links">
          <h2 className="pp-section-title">
            LINKS
            <span className="pp-count">
              {view.totalLinks} TOTAL · {view.pinnedLinksCount} PINNED
            </span>
          </h2>
          <ProfileLinksList
            links={view.profileLinks}
            totalLinks={view.totalLinks}
            pinnedLinksCount={view.pinnedLinksCount}
          />
        </section>

        {/* ═══ ABOUT ME ═══ */}
        <section className="pp-section" data-pane="about">
          <h2 className="pp-section-title">ABOUT ME</h2>
          <p className="pp-about-body">{view.about}</p>
          <div className="pp-aliases">
            <span className="pp-key">PREVIOUSLY KNOWN AS:</span>
            <span className="pp-alias-chip">@CryptoMarkOG</span>
            <span className="pp-alias-chip">@MarkTheShiller</span>
          </div>
        </section>

        {/* ═══ VERIFICATIONS ═══ */}
        <section className="pp-section" data-pane="verify">
          <h2 className="pp-section-title">
            VERIFICATIONS
            <span className="pp-count">{view.recentProofs.length} OF {view.totalProofs}</span>
          </h2>
          <ProofsTable proofs={view.recentProofs} totalProofs={view.totalProofs} />
        </section>

        {view.variant === "legend" ? <LegendCtaSwitch /> : <CtaStrip />}
      </div>
    </div>
  );
}
