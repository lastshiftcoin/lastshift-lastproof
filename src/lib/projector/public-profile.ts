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
import { deriveProfileVariant } from "../tier";
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

  const tier = profile.tier as Tier;
  const paid = isPaidNow({ expiresAt: profile.subscriptionExpiresAt });
  const isPublished = profile.publishedAt !== null;

  // Preview mode: force full profile variant regardless of tier/paid status.
  // Auth check happens in the page — the projector trusts the caller.
  const variant = options?.previewMode
    ? (profile.isEarlyAdopter ? "legend" : "public")
    : deriveProfileVariant({ tier, isEarlyAdopter: profile.isEarlyAdopter });

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
      shortWallet: shortenWallet(p.txSignature.slice(0, 16)),
      isDev: p.kind === "dev_verification",
      ticker: wi?.ticker ?? "",
      date: formatDate(p.createdAt),
      comment: null, // NOTE: proofs store doesn't have comment field yet; future migration
      solscanUrl: `https://solscan.io/tx/${p.txSignature}`,
    };
  });

  // ─── 8. Counts ─────────────────────────────────────────────────────
  const proofsConfirmed = proofRows.length;
  const devProofsConfirmed = (proofRows as StoreProofRow[]).filter(
    (p) => p.kind === "dev_verification",
  ).length;

  // ─── 9. Tier bar math ──────────────────────────────────────────────
  const tierBarFillPct = Math.min(100, Math.round((proofsConfirmed / 50) * 100));
  const remaining = Math.max(0, 50 - proofsConfirmed);
  const tierSubtitle =
    tier === 4
      ? `${proofsConfirmed} verified proofs · TIER 4 · LEGEND`
      : `${proofsConfirmed} verified proofs · ${remaining} to TIER ${tier + 1 > 4 ? 4 : tier + 1} · ${{
          1: "NEW → VERIFIED",
          2: "VERIFIED → EXPERIENCED",
          3: "EXPERIENCED → LEGEND",
          4: "LEGEND",
          5: "",
        }[tier]}`;

  // ─── 10. Assemble the view ─────────────────────────────────────────
  return {
    variant,
    ownerWallet: profile.terminalWallet,
    handle: profile.handle,
    displayName: profile.displayName ?? profile.handle,
    avatarUrl: profile.avatarUrl,
    avatarMonogram: (profile.displayName ?? profile.handle).charAt(0).toUpperCase(),

    state: isPaidNow({ expiresAt: profile.subscriptionExpiresAt })
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
    hireTelegramHandle: profile.hireTelegramHandle,
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
