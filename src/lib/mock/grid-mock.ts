/**
 * Typed mock for the /operators Grid feed.
 *
 * Stage 1 of Phase 2 — the visual scaffold reads from this static array
 * so the page renders end-to-end without backend wiring. Stage 2 swaps
 * this for `getGridList()` against the `grid_operators` Supabase view.
 *
 * Mix is deliberate per the Cowork brief deliverable spec:
 *   - At least one T4 LEGEND
 *   - Two T3 EXPERIENCED
 *   - Two T2 VERIFIED
 *   - One T1 NEW with 0 proofs (minimum-state card)
 *   - Several with 0 DEV proofs to show that state
 *   - Several with the EA badge — wait, no EA badge on Grid cards (Kellen
 *     dropped it in Frontend polish). isVerified surfaces the ✓ check.
 */

import type { GridCardView } from "../grid/grid-view";

export const GRID_MOCK: GridCardView[] = [
  {
    handle: "cryptomark",
    displayName: "CryptoMark",
    avatarUrl: null,
    avatarMonogram: "CM",
    tier: 3,
    isVerified: true,
    proofsConfirmed: 47,
    devProofsConfirmed: 3,
    projectsCount: 50,
    timezone: "UTC-5",
    language: "EN",
    feeRange: "$$$",
    categories: [
      { slug: "shiller", label: "Shiller" },
      { slug: "raid-leader", label: "Raid Leader" },
      { slug: "community-manager", label: "Community Manager" },
    ],
    shortBio:
      "Three years in the trenches of web3 marketing. Taken projects from zero to 15K organic followers on X through cold-start raid ops and a ruthless reply-guy rotation. Prefer long-haul positions with founders who ship.",
    publishedAt: "2026-02-12T00:00:00Z",
  },
  {
    handle: "raidqueen",
    displayName: "RaidQueen",
    avatarUrl: null,
    avatarMonogram: "RQ",
    tier: 4,
    isVerified: true,
    proofsConfirmed: 112,
    devProofsConfirmed: 18,
    projectsCount: 78,
    timezone: "UTC+1",
    language: "EN / DE",
    feeRange: "$$$$",
    categories: [
      { slug: "raid-leader", label: "Raid Leader" },
      { slug: "shiller", label: "Shiller" },
      { slug: "kol-influencer", label: "KOL / Influencer" },
    ],
    shortBio:
      "Legendary raid coordinator. Ran the pushes behind three of the five biggest Solana memecoin rotations of Q1. Squads are trained, consistent, and don't require hand-holding — handoff protocol included.",
    publishedAt: "2025-11-01T00:00:00Z",
  },
  {
    handle: "vibesonly",
    displayName: "vibesonly",
    avatarUrl: null,
    avatarMonogram: "VO",
    tier: 3,
    isVerified: true,
    proofsConfirmed: 31,
    devProofsConfirmed: 0,
    projectsCount: 22,
    timezone: "UTC+8",
    language: "EN / JP",
    feeRange: "$$",
    categories: [
      { slug: "content-creator", label: "Content Creator" },
      { slug: "shiller", label: "Shiller" },
      { slug: "community-manager", label: "Community Manager" },
    ],
    shortBio:
      "Asia-timezone vibes + long-form threads. Specialize in narrative framing and visual content that holds attention past the 3-second mark. Bilingual writes land cleanly on both EN and JP sides of the market.",
    publishedAt: "2026-01-08T00:00:00Z",
  },
  {
    handle: "pixelprof",
    displayName: "pixelprof",
    avatarUrl: null,
    avatarMonogram: "PP",
    tier: 2,
    isVerified: true,
    proofsConfirmed: 18,
    devProofsConfirmed: 2,
    projectsCount: 14,
    timezone: "UTC-8",
    language: "EN / ES",
    feeRange: "$$",
    categories: [
      { slug: "brand-creative", label: "Brand / Creative" },
      { slug: "vibe-coder-builder", label: "Vibe Coder / Builder" },
    ],
    shortBio:
      "Brand + creative for degens. Logos, mint assets, meme packs, pitch decks, and campaign visuals that actually convert. Turnaround measured in hours, not days.",
    publishedAt: "2026-02-22T00:00:00Z",
  },
  {
    handle: "shillbot_eth",
    displayName: "ShillBot_eth",
    avatarUrl: null,
    avatarMonogram: "SE",
    tier: 2,
    isVerified: false,
    proofsConfirmed: 12,
    devProofsConfirmed: 0,
    projectsCount: 9,
    timezone: "UTC+0",
    language: "EN",
    feeRange: "$",
    categories: [
      { slug: "shiller", label: "Shiller" },
      { slug: "alpha-caller", label: "Alpha Caller" },
    ],
    shortBio:
      "Reply-guy operator across EU hours. Volume-first, quality second-but-close. Best deployed on cold-start projects needing trench presence before a community forms.",
    publishedAt: "2026-03-04T00:00:00Z",
  },
  {
    handle: "alpharyan",
    displayName: "alpharyan",
    avatarUrl: null,
    avatarMonogram: "AR",
    tier: 3,
    isVerified: true,
    proofsConfirmed: 28,
    devProofsConfirmed: 5,
    projectsCount: 16,
    timezone: "UTC-5",
    language: "EN",
    feeRange: "$$$",
    categories: [
      { slug: "alpha-caller", label: "Alpha Caller" },
      { slug: "kol-influencer", label: "KOL / Influencer" },
    ],
    shortBio:
      "Early-stage alpha caller running a private 4K-seat TG group. On-chain breakdowns before the front-runs. Deep Solana + mid-cap EVM coverage.",
    publishedAt: "2025-12-15T00:00:00Z",
  },
  {
    handle: "modquendelta",
    displayName: "modquendelta",
    avatarUrl: null,
    avatarMonogram: "MQ",
    tier: 2,
    isVerified: true,
    proofsConfirmed: 14,
    devProofsConfirmed: 1,
    projectsCount: 11,
    timezone: "UTC+2",
    language: "EN / TR",
    feeRange: "$$",
    categories: [
      { slug: "mod", label: "Mod" },
      { slug: "community-manager", label: "Community Manager" },
    ],
    shortBio:
      "Moderation specialist. Set up scam-filter bots, automod rules, raid-defense playbooks. The person a CM hires when the chat doubles overnight.",
    publishedAt: "2026-02-01T00:00:00Z",
  },
  {
    handle: "spacehostjax",
    displayName: "spacehostjax",
    avatarUrl: null,
    avatarMonogram: "SJ",
    tier: 4,
    isVerified: true,
    proofsConfirmed: 67,
    devProofsConfirmed: 12,
    projectsCount: 43,
    timezone: "UTC-4",
    language: "EN",
    feeRange: "$$$$",
    categories: [
      { slug: "space-host-ama-host", label: "Space Host / AMA Host" },
      { slug: "kol-influencer", label: "KOL / Influencer" },
    ],
    shortBio:
      "Host 3–5 AMAs a week across X Spaces and TG voice. Booked out six weeks, ticker-slot discounts for devs with working product, full recording + clip-pack delivered 24h post.",
    publishedAt: "2025-09-20T00:00:00Z",
  },
  {
    handle: "bdsenpai",
    displayName: "BDsenpai",
    avatarUrl: null,
    avatarMonogram: "BS",
    tier: 3,
    isVerified: true,
    proofsConfirmed: 35,
    devProofsConfirmed: 6,
    projectsCount: 24,
    timezone: "UTC+9",
    language: "JP / EN",
    feeRange: "$$$",
    categories: [
      { slug: "bd-partnerships", label: "BD / Partnerships" },
      { slug: "collab-manager", label: "Collab Manager" },
      { slug: "pr-comms", label: "PR / Comms" },
    ],
    shortBio:
      "BD operator embedded in the APAC circuit. Exchange intros, co-marketing sit-downs, whitelist swaps with KR + JP communities most western teams can't warm up on their own.",
    publishedAt: "2025-10-30T00:00:00Z",
  },
  {
    handle: "fresh_mint",
    displayName: "fresh_mint",
    avatarUrl: null,
    avatarMonogram: "FM",
    tier: 1,
    isVerified: false,
    proofsConfirmed: 0,
    devProofsConfirmed: 0,
    projectsCount: 0,
    timezone: "UTC-3",
    language: "PT / EN",
    feeRange: "$",
    categories: [{ slug: "community-manager", label: "Community Manager" }],
    shortBio:
      "Fresh LASTPROOF profile — no proofs yet, building from zero. Background in Discord community ops outside web3. Open to small trial engagements on seed-stage projects.",
    publishedAt: "2026-04-18T00:00:00Z",
  },
];

/**
 * Mock recent proofs for the LIVE ticker. Real ones come from
 * `getRecentProofs(20)` in Stage 2.
 */
export interface MockTickerProof {
  shortWallet: string;
  operatorHandle: string;
  projectTicker: string;
  isDev: boolean;
  timeAgo: string;
}

export const TICKER_MOCK: MockTickerProof[] = [
  { shortWallet: "9xK…aZ2", operatorHandle: "CryptoMark", projectTicker: "$BONK", isDev: true, timeAgo: "2m ago" },
  { shortWallet: "Hf4…pQ8", operatorHandle: "RaidQueen", projectTicker: "$WIF", isDev: false, timeAgo: "6m ago" },
  { shortWallet: "3nm…V1c", operatorHandle: "alpharyan", projectTicker: "$JUP", isDev: true, timeAgo: "11m ago" },
  { shortWallet: "Gb7…yT5", operatorHandle: "vibesonly", projectTicker: "$POPCAT", isDev: false, timeAgo: "17m ago" },
  { shortWallet: "Df9…u2k", operatorHandle: "spacehostjax", projectTicker: "$FARTCOIN", isDev: true, timeAgo: "22m ago" },
  { shortWallet: "L8p…Kr6", operatorHandle: "pixelprof", projectTicker: "$MOTHER", isDev: false, timeAgo: "28m ago" },
  { shortWallet: "W4t…X9n", operatorHandle: "BDsenpai", projectTicker: "$DRIFT", isDev: true, timeAgo: "34m ago" },
];

/**
 * Mock category-count-sorted list for the chip row. Real values come from
 * the `categories.operator_count` column in Stage 2 (cron-cached daily).
 *
 * Sorted by count descending — the homepage canon order plus aggregated
 * counts from the wireframe sample.
 */
export interface MockCategoryChip {
  slug: string;
  label: string;
  count: number;
}

export const CATEGORY_CHIPS_MOCK: MockCategoryChip[] = [
  { slug: "shiller", label: "Shiller", count: 428 },
  { slug: "community-manager", label: "Community Manager", count: 312 },
  { slug: "kol-influencer", label: "KOL / Influencer", count: 256 },
  { slug: "content-creator", label: "Content Creator", count: 221 },
  { slug: "raid-leader", label: "Raid Leader", count: 198 },
  { slug: "mod", label: "Mod", count: 174 },
  { slug: "brand-creative", label: "Brand / Creative", count: 149 },
  { slug: "alpha-caller", label: "Alpha Caller", count: 132 },
  { slug: "space-host-ama-host", label: "Space Host / AMA Host", count: 118 },
  { slug: "growth-paid-media", label: "Growth / Paid Media", count: 104 },
  { slug: "collab-manager", label: "Collab Manager", count: 87 },
  { slug: "bd-partnerships", label: "BD / Partnerships", count: 72 },
  { slug: "pr-comms", label: "PR / Comms", count: 64 },
  { slug: "vibe-coder-builder", label: "Vibe Coder / Builder", count: 48 },
  { slug: "token-dev-tokenomics", label: "Token Dev / Tokenomics", count: 31 },
];
