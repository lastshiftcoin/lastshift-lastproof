import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { getPublicProfileView } from "@/lib/projector/public-profile";
import { readSession } from "@/lib/session";
import { getProfileByHandle, incrementViewCount } from "@/lib/db/profiles-adapter";
import { supabaseService } from "@/lib/db/client";
import { cryptomarkProfile } from "@/lib/mock/cryptomark-profile";
import { shipfastProfile } from "@/lib/mock/shipfast-profile";
import { newbuilderProfile } from "@/lib/mock/newbuilder-profile";
import type { PublicProfileView } from "@/lib/public-profile-view";

import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileTopBar } from "@/components/profile/ProfileTopBar";
import { LegendCtaSwitch } from "@/components/profile/LegendCtaSwitch";
import { TrustTierBar } from "@/components/profile/TrustTierBar";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { ChadArmyStrip } from "@/components/chad/ChadArmyStrip";
import { isChadsEnabled } from "@/lib/chads/feature-flag";
import { listAcceptedByRequester, countAcceptedByRequester } from "@/lib/db/chads-adapter";
import { resolveChadProfilesOrdered } from "@/lib/chads/profile-batch";
import { StatStrip } from "@/components/profile/StatStrip";
import { CategoryChips } from "@/components/profile/CategoryChips";
import { WorkItemList } from "@/components/profile/WorkItemList";
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

/**
 * Build the `ProfilePage` + `Person` JSON-LD for this profile. Embedded
 * as `<script type="application/ld+json">` on paid/legend variants so
 * Google can render rich results (name, photo, role, social links) in
 * search — not just a plain link. Free profiles don't get structured
 * data, consistent with being excluded from the sitemap.
 *
 * Spec: https://schema.org/ProfilePage
 */
function buildProfileJsonLd(view: PublicProfileView): Record<string, unknown> {
  const profileUrl = `https://lastproof.app/@${view.handle}`;

  // sameAs lists verified cross-platform identities + the operator's
  // own website. Only verified socials are included — Google uses
  // sameAs to build the entity's identity graph; unverified claims
  // would poison that graph.
  const sameAs: string[] = [];
  if (view.xVerified && view.xHandle) sameAs.push(`https://x.com/${view.xHandle}`);
  if (view.tgVerified && view.tgHandle) sameAs.push(`https://t.me/${view.tgHandle}`);
  if (view.website) sameAs.push(view.website);

  const primaryCategory =
    view.categories.find((c) => c.isPrimary) ?? view.categories[0];
  const jobTitle = primaryCategory?.label ?? "Web3 Operator";

  const description =
    view.bioStatement ||
    `${view.displayName} is a verified web3 operator on LASTPROOF with ${view.proofsConfirmed} on-chain proof${view.proofsConfirmed === 1 ? "" : "s"}${view.projectsCount > 0 ? ` across ${view.projectsCount} project${view.projectsCount === 1 ? "" : "s"}` : ""}.`;

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: profileUrl,
    mainEntity: {
      "@type": "Person",
      name: view.displayName,
      alternateName: `@${view.handle}`,
      url: profileUrl,
      ...(view.avatarUrl ? { image: view.avatarUrl } : {}),
      description: description.slice(0, 500),
      jobTitle,
      ...(sameAs.length > 0 ? { sameAs } : {}),
    },
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const view = (await getPublicProfileView(handle)) ?? FIXTURES[handle] ?? null;
  if (!view) return { title: `@${handle} — LASTPROOF` };

  const title = `@${view.handle} — ${view.displayName} | LASTPROOF Operator`;
  const description = view.bioStatement
    ? view.bioStatement.slice(0, 160)
    : `${view.displayName} is a verified web3 operator on LASTPROOF with ${view.proofsConfirmed} on-chain proofs.`;
  const profileUrl = `https://lastproof.app/@${view.handle}`;

  return {
    title,
    description,
    openGraph: {
      type: "profile",
      title,
      description,
      url: profileUrl,
      ...(view.avatarUrl && {
        images: [{ url: view.avatarUrl, width: 400, height: 400, alt: view.displayName }],
      }),
    },
    twitter: {
      card: "summary",
      title,
      description,
      ...(view.avatarUrl && { images: [view.avatarUrl] }),
    },
  };
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

  if (!view) {
    // Check if this is an old handle that was changed — redirect to new handle
    const { data: historyRow } = await supabaseService()
      .from("handle_history")
      .select("new_handle")
      .ilike("old_handle", handle)
      .order("changed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (historyRow?.new_handle) {
      redirect(`/@${historyRow.new_handle}`);
    }

    notFound();
  }

  // Increment view count for non-owner visitors (fire-and-forget)
  if (!isPreview) {
    const session = await readSession();
    const isOwner = session && view.ownerWallet === session.walletAddress;
    if (!isOwner) {
      incrementViewCount(handle).catch(() => {});
    }
  }

  // Look up if this profile owner is an ambassador → pass campaign slug to CTA strips
  let campaignSlug: string | null = null;
  if (view.ownerWallet) {
    const { data: amb } = await supabaseService()
      .from("ambassadors")
      .select("campaign_slug")
      .eq("wallet", view.ownerWallet)
      .eq("is_active", true)
      .maybeSingle();
    if (amb) campaignSlug = amb.campaign_slug;
  }

  // Founder override: @lastshiftfounder's footer CTA points at the
  // general marketing landing page (/earlyaccess), not /manage. This
  // is the company-owned URL with no referral tracking — the founder
  // isn't an ambassador of themselves.
  if (view.handle === "lastshiftfounder") {
    campaignSlug = "earlyaccess";
  }

  // Chad function — gated. When the flag is off, every chad surface
  // returns null and the page renders byte-identical to today.
  const session = await readSession();
  const chadsOn = isChadsEnabled(session?.walletAddress);
  let chadInitialItems: Awaited<ReturnType<typeof resolveChadProfilesOrdered>> = [];
  let chadArmyCount = 0;
  if (chadsOn && view.variant !== "free" && view.ownerWallet) {
    // Profile owner's army = chads they've added (directional).
    const rows = await listAcceptedByRequester(view.ownerWallet, undefined, 12);
    const otherWallets = rows.map((r) => r.targetWallet);
    chadInitialItems = await resolveChadProfilesOrdered(otherWallets);
    chadArmyCount = await countAcceptedByRequester(view.ownerWallet);
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
            bioStatement={view.bioStatement}
            timezone={view.timezone}
            language={view.language}
            feeRange={view.feeRange}
            xHandle={view.xHandle}
            tgHandle={view.tgHandle}
            website={view.website}
            hireTelegramHandle={view.hireTelegramHandle}
          />
          <CtaStrip variant="free" campaignSlug={campaignSlug} />
        </div>
      </div>
    );
  }

  const mintedItems = view.workItems.filter((w) => w.section === "minted");
  const recentItems = view.workItems.filter((w) => w.section === "recent");

  // Structured data for search engines — see buildProfileJsonLd() above.
  const jsonLd = buildProfileJsonLd(view);

  return (
    <div className="pp-page pp-page-bg">
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
          bioStatement={view.bioStatement}
          timezone={view.timezone}
          language={view.language}
          feeRange={view.feeRange}
          xHandle={view.xHandle}
          tgHandle={view.tgHandle}
          website={view.website}
          hireTelegramHandle={view.hireTelegramHandle}
          chadsEnabled={chadsOn}
        />

        <TrustTierBar
          tier={view.tier}
          tierBarFillPct={view.tierBarFillPct}
          tierSubtitle={view.tierSubtitle}
        />

        {chadsOn && (
          <ChadArmyStrip
            handle={view.handle}
            chads={chadInitialItems}
            armyCount={chadArmyCount}
          />
        )}

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

          <WorkItemList
            items={mintedItems}
            handle={view.handle}
            ownerWallet={view.ownerWallet}
            sectionLabel="MINTED PROJECTS"
          />
          <WorkItemList
            items={recentItems}
            handle={view.handle}
            ownerWallet={view.ownerWallet}
            sectionLabel="RECENT"
            sectionClass="pp-recent"
          />
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
          {view.previousHandles.length > 0 && (
            <div className="pp-aliases">
              <span className="pp-key">PREVIOUSLY KNOWN AS:</span>
              {view.previousHandles.map((h) => (
                <span key={h} className="pp-alias-chip">@{h}</span>
              ))}
            </div>
          )}
        </section>

        {/* ═══ VERIFICATIONS ═══ */}
        <section className="pp-section" data-pane="verify">
          <h2 className="pp-section-title">
            VERIFICATIONS
            <span className="pp-count">{view.recentProofs.length} OF {view.totalProofs}</span>
          </h2>
          <ProofsTable proofs={view.recentProofs} totalProofs={view.totalProofs} />
        </section>

        {view.variant === "legend" ? <LegendCtaSwitch campaignSlug={campaignSlug} /> : <CtaStrip campaignSlug={campaignSlug} />}
      </div>
    </div>
  );
}
