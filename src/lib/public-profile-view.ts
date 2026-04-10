/**
 * PublicProfileView — the single shape the /@handle page consumes.
 *
 * Step 1 is mock-only. Step 3 swaps the mock for a real projector that
 * fans out to profiles + work_items + screenshots + profile_links +
 * profile_categories stores. The shape stays stable across that swap.
 *
 * See `docs/NEXT-PUBLIC-PROFILE.md` §4 for the full spec.
 */

import type { Tier } from "./tier";
import type { SubscriptionState } from "./subscription";

/**
 * Variant selector — drives which layout + CTA strip the route renders.
 *  - "public" → standard paid profile (cryptomark)
 *  - "legend" → 95% identical to public but swaps the footer CTA for the
 *    purple/orange FOMO "first 5,000 operators" strip. Legend profiles keep
 *    the 5K founder avatar badge.
 *  - "free"   → stripped-down: hero + single CTA strip only. No tier bar,
 *    tabs, stats, PoW, screenshots, links, about, verifications, or hire
 *    button. Hero shows a `> UPGRADE PROFILE` button that links to /manage.
 */
export type ProfileVariant = "public" | "legend" | "free";

export interface PublicProfileView {
  // ─── Variant dispatch ────────────────────────────────────────
  variant: ProfileVariant;

  // ─── Identity (hero) ─────────────────────────────────────────
  /** Owner's terminal wallet — used by self-proof guard. Never displayed. */
  ownerWallet: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  avatarMonogram: string;

  // ─── State pills ─────────────────────────────────────────────
  state: SubscriptionState;
  statusLabel: "ACTIVE" | "WARNING" | "NON-ACTIVE";
  tier: Tier;
  isEarlyAdopter: boolean;
  earlyAdopterNumber: number | null;

  // ─── Headline + meta ─────────────────────────────────────────
  headline: string;
  timezone: string;
  language: string;
  feeRange: "$" | "$$" | "$$$" | "$$$$";

  // ─── Verified socials ────────────────────────────────────────
  xHandle: string | null;
  xVerified: boolean;
  tgHandle: string | null;
  tgVerified: boolean;
  website: string | null;
  hireTelegramHandle: string | null;
  /** True only if x AND tg are both verified. Drives the blue checkmark. */
  isVerified: boolean;

  // ─── Trust tier strip ────────────────────────────────────────
  proofsConfirmed: number;
  devProofsConfirmed: number;
  projectsCount: number;
  /** (proofsConfirmed / 50) * 100, capped at 100. */
  tierBarFillPct: number;
  /** e.g. "47 verified proofs · 3 to TIER 4 · LEGEND" */
  tierSubtitle: string;

  // ─── Categories ──────────────────────────────────────────────
  categories: ProfileCategory[];

  // ─── Tab panes ───────────────────────────────────────────────
  pitchBody: string;
  about: string;
  bioStatement: string;

  workItems: WorkItem[];
  screenshots: Screenshot[];
  profileLinks: ProfileLink[];
  recentProofs: ProofRow[];

  // ─── Counts surfaced in section titles ──────────────────────
  totalWorkItems: number;
  totalProofs: number;
  totalScreenshots: number;
  totalLinks: number;
  pinnedLinksCount: number;
}

export interface ProfileCategory {
  slug: string;
  label: string;
  isPrimary: boolean;
}

export interface WorkItem {
  id: string;
  ticker: string;
  role: string;
  description: string;
  startedAt: string;
  endedAt: string | null;
  isMinted: boolean;
  isDev: boolean;
  isCurrent: boolean;
  proofCount: number;
  /** Visual grouping in the PoW list — "minted" header vs "recent" header. */
  section: "minted" | "recent";
}

export interface Screenshot {
  id: string;
  imageUrl: string;
  previewUrl: string;
  aspectRatio: number;
  caption: string | null;
  linkedUrl: string | null;
  position: number;
}

export interface ProfileLink {
  id: string;
  label: string;
  handle: string;
  url: string;
  /** Icon key — "tg" | "x" | "web" | "dc" — drives the chip icon. */
  platform: "tg" | "x" | "web" | "dc";
  isPinned: boolean;
  position: number;
}

export interface ProofRow {
  id: string;
  shortWallet: string;
  isDev: boolean;
  ticker: string;
  date: string;
  comment: string | null;
  solscanUrl: string;
}
