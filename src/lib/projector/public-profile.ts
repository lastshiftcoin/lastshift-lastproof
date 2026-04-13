/**
 * Public profile projector — assembles a `PublicProfileView` from the
 * Supabase stores for a given handle.
 *
 * This is the Step 3 replacement for the static mock fixtures. It fans out
 * reads across profiles, work_items, screenshots, profile_links,
 * profile_categories, and proofs stores, then transforms the raw rows into
 * the view shape consumed by `/(marketing)/profile/[handle]/page.tsx`.
 *
 * Projection rules:
 *   - `variant` is derived via `deriveProfileVariant()` — single source of truth.
 *   - `tier` is read from the cached `profiles.tier` column, which `computeTier()`
 *     writes on every proof confirm / cron / publish.
 *   - Work items are split into "minted" vs "recent" sections based on `minted` flag.
 *   - Proof count per work item uses the proofs join via `work_items → proofs`.
 *   - "isCurrent" = endedAt is null.
 *   - proofCount per work item = count of confirmed proofs against that work_item_id.
 *   - Platform detection for links = URL pattern (t.me → tg, x.com → x, discord → dc, else web).
 *   - isPinned for links = position < pinnedLinksCount threshold (first N by position).
 */

import type {
  PublicProfileView,
  WorkItem,
  Screenshot,
  ProfileLink,
  ProfileCategory,
  ProofRow as ViewProofRow,
} from "../public-profile-view";
import type { Tier } from "../tier";
import { computeTier, deriveProfileVariant } from "../tier";
import { isPaidNow } from "../subscription";

import { getProfileByHandle } from "../db/profiles-adapter";
import { listWorkItemsByProfile, countProofsByWorkItem } from "../db/work-items-adapter";
import { listScreenshotsByProfile } from "../db/screenshots-adapter";
import { listProfileLinksByProfile } from "../db/profile-links-adapter";
import { listCategoriesByProfile } from "../db/profile-categories-adapter";
import { listProofsByProfile } from "../db/proofs-adapter";
import { listByProfile as listHandleHistory } from "../db/handle-history-adapter";
import type { ProofRow as StoreProofRow } from "../proofs-store";

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Derive platform from URL for link chips. */
function detectPlatform(url: string): ProfileLink["platform"] {
  if (url.includes("t.me/") || url.includes("telegram.")) return "tg";
  if (url.includes("x.com/") || url.includes("twitter.com/")) return "x";
  if (url.includes("discord.gg/") || url.includes("discord.com/")) return "dc";
  return "web";
}

/** Extract a display handle from a URL (e.g. "https://t.me/cryptomark" → "t.me/cryptomark"). */
function extractHandle(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.replace(/\/$/, "");
  } catch {
    return url;
  }
}

/** Format a date string to the wireframe convention: "MAR 20, 2026". */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Shorten a wallet address: "F7k2QJ...9xMp" */
function shortenWallet(wallet: string): string {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

// How many links are considered "pinned" — first N by position.
const PINNED_LINKS_THRESHOLD = 6;

// ─── Projector ─────────────────────────────────────────────────────────────

/**
 * Assemble a complete PublicProfileView for a given handle.
 * Returns null if the handle doesn't match any profile in the database.
 *
 * This function is designed to be called from the profile page's server
 * component. It performs all Supabase reads in parallel where possible.
 */
export async function getPublicProfileView(
  handle: string,
  options?: { previewMode?: boolean },
): Promise<PublicProfileView | null> {
  // ─── 1. Fetch the profile row ──────────────────────────────────────
  const profile = await getProfileByHandle(handle);
  if (!profile) return null;

  // Use profile.isPaid directly — isPaidNow only checks subscription expiry,
  // but EA profiles have null expiry pre-grid-launch and are still paid.
  const paid = profile.isPaid;
  const isPublished = profile.publishedAt !== null;

  // ─── 2. Fan out reads in parallel ──────────────────────────────────
  const [workItemRows, screenshotRows, linkRows, categoryRows, proofRows, handleHistoryRows] =
    await Promise.all([
      listWorkItemsByProfile(profile.id),
      listScreenshotsByProfile(profile.id),
      listProfileLinksByProfile(profile.id),
      listCategoriesByProfile(profile.id),
      listProofsByProfile(profile.id),
      listHandleHistory(profile.id),
    ]);

  // ─── 3. Enrich work items with proof counts ────────────────────────
  const proofCounts = await Promise.all(
    workItemRows.map((wi) => countProofsByWorkItem(wi.id)),
  );

  const workItems: WorkItem[] = workItemRows.map((wi, i) => ({
    id: wi.id,
    ticker: wi.ticker ?? "",
    role: wi.role,
    description: wi.description ?? "",
    startedAt: wi.startedAt ?? "",
    endedAt: wi.endedAt,
    isMinted: wi.minted,
    isDev: wi.isDev,
    isCurrent: wi.endedAt === null,
    proofCount: proofCounts[i],
    section: wi.minted ? "minted" as const : "recent" as const,
  }));

  // ─── 4. Transform screenshots ──────────────────────────────────────
  const screenshots: Screenshot[] = screenshotRows.map((s) => ({
    id: s.id,
    imageUrl: s.imageUrl,
    previewUrl: s.previewUrl,
    aspectRatio: s.aspectRatio ?? 1.78,
    caption: s.caption,
    linkedUrl: s.linkedUrl,
    position: s.position,
  }));

  // ─── 5. Transform links with platform detection ────────────────────
  const profileLinks: ProfileLink[] = linkRows.map((lk) => ({
    id: lk.id,
    label: lk.label,
    handle: extractHandle(lk.url),
    url: lk.url,
    platform: detectPlatform(lk.url),
    isPinned: lk.pinned,
    position: lk.position,
  }));

  // ─── 6. Transform categories ───────────────────────────────────────
  const categories: ProfileCategory[] = categoryRows.map((c, i) => ({
    slug: c.slug,
    label: c.label,
    isPrimary: i === 0,
  }));

  // ─── 7. Transform recent proofs (last 5) ───────────────────────────
  const confirmedProofs = (proofRows as StoreProofRow[])
    .filter((p) => p.txSignature)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // For proof rows we need to join back to work items for the ticker
  const workItemMap = new Map(workItemRows.map((wi) => [wi.id, wi]));

  const recentProofs: ViewProofRow[] = confirmedProofs.map((p) => {
    const wi = p.workItemId ? workItemMap.get(p.workItemId) : null;
    return {
      id: p.id,
      shortWallet: p.payerWallet ? shortenWallet(p.payerWallet) : "unknown",
      isDev: p.kind === "dev_verification",
      ticker: wi?.ticker ?? "",
      date: formatDate(p.createdAt),
      comment: (p as unknown as { note: string | null }).note ?? null,
      solscanUrl: `https://solscan.io/tx/${p.txSignature}`,
    };
  });

  // ─── 8. Counts ─────────────────────────────────────────────────────
  const proofsConfirmed = proofRows.length;
  const devProofsConfirmed = (proofRows as StoreProofRow[]).filter(
    (p) => p.kind === "dev_verification",
  ).length;

  // ─── 9. Compute tier live (don't trust cached DB value) ────────────
  const tier = computeTier({
    isPaid: paid,
    isPublished,
    proofsConfirmed,
  });

  const variant = deriveProfileVariant({ tier, isEarlyAdopter: profile.isEarlyAdopter });

  // ─── 10. Tier bar math ─────────────────────────────────────────────
  // Progress bar fills from current tier threshold to next tier threshold.
  // Tier 1 (NEW):         0 → 10   (next: VERIFIED)
  // Tier 2 (VERIFIED):   10 → 25   (next: EXPERIENCED)
  // Tier 3 (EXPERIENCED): 25 → 50  (next: LEGEND)
  // Tier 4 (LEGEND):     50+       (bar stays full)
  const currentThreshold = tier === 1 ? 0 : tier === 2 ? 10 : tier === 3 ? 25 : 50;
  const nextThreshold = tier === 1 ? 10 : tier === 2 ? 25 : tier === 3 ? 50 : 50;
  const segmentSize = nextThreshold - currentThreshold;
  const progressInSegment = proofsConfirmed - currentThreshold;
  const tierBarFillPct = tier === 4
    ? 100
    : Math.min(100, Math.round((progressInSegment / segmentSize) * 100));
  const remaining = Math.max(0, nextThreshold - proofsConfirmed);
  const nextTier = Math.min(tier + 1, 4);
  const progressLabel: Record<number, string> = {
    1: "NEW → VERIFIED",
    2: "VERIFIED → EXPERIENCED",
    3: "EXPERIENCED → LEGEND",
    4: "LEGEND",
    5: "",
  };
  const tierSubtitle =
    tier === 4
      ? `${proofsConfirmed} verified proofs · TIER 4 · LEGEND`
      : `${proofsConfirmed} verified proofs · ${remaining} to TIER ${nextTier} · ${progressLabel[tier]}`;

  // ─── 10. Assemble the view ─────────────────────────────────────────
  return {
    variant,
    ownerWallet: profile.terminalWallet,
    handle: profile.handle,
    displayName: profile.displayName ?? profile.handle,
    avatarUrl: profile.avatarUrl,
    avatarMonogram: (profile.displayName ?? profile.handle).charAt(0).toUpperCase(),

    state: paid
      ? "active"
      : profile.subscriptionExpiresAt
        ? "expired"
        : "none",
    statusLabel: paid && isPublished ? "ACTIVE" : isPublished ? "WARNING" : "NON-ACTIVE",
    tier,
    isEarlyAdopter: profile.isEarlyAdopter,
    earlyAdopterNumber: profile.eaNumber ?? null,

    headline: profile.headline ?? "",
    timezone: profile.timezone ?? "",
    language: profile.secondaryLanguage
      ? `${(profile.language ?? "ENGLISH").toUpperCase()} / ${profile.secondaryLanguage.toUpperCase()}`
      : (profile.language ?? "ENGLISH"),
    feeRange: (profile.feeRange ?? "$") as PublicProfileView["feeRange"],

    xHandle: profile.xHandle,
    xVerified: profile.xVerified,
    tgHandle: profile.tgHandle,
    tgVerified: profile.tgVerified,
    website: profile.website,
    hireTelegramHandle: profile.hireTelegramHandle
      ?? (profile.tgVerified ? profile.tgHandle : null),
    isVerified: profile.xVerified && profile.tgVerified,

    proofsConfirmed,
    devProofsConfirmed,
    projectsCount: workItems.length,
    tierBarFillPct,
    tierSubtitle,

    categories,
    pitchBody: profile.pitch ?? "",
    about: profile.about ?? "",
    bioStatement: profile.bioStatement ?? "",
    previousHandles: handleHistoryRows.map((h) => h.oldHandle),

    workItems,
    screenshots,
    profileLinks,
    recentProofs,

    viewCount: profile.viewCount,
    totalWorkItems: workItems.length,
    totalProofs: proofsConfirmed,
    totalScreenshots: screenshots.length,
    totalLinks: profileLinks.length,
    pinnedLinksCount: profileLinks.filter((l) => l.isPinned).length,
  };
}
