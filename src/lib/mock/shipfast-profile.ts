/**
 * Shipfast mock — fixture for the LEGEND / founding-5000 variant.
 *
 * Structurally identical to the public variant. The only rendering deltas
 * driven by `variant: "legend"` are:
 *   1. 5K founder badge visible on the avatar
 *   2. Footer CTA swapped for the purple/orange FOMO strip
 *
 * Values are lifted from `wireframes/lastproof-profile-5000.html` and
 * adapted so the handle is distinguishable from cryptomark.
 */

import type { PublicProfileView } from "../public-profile-view";

export const shipfastProfile: PublicProfileView = {
  variant: "legend",

  // ─── Identity ────────────────────────────────────────────────
  handle: "shipfast",
  displayName: "ShipFast",
  avatarUrl: null,
  avatarMonogram: "S",

  // ─── State ───────────────────────────────────────────────────
  state: "active",
  statusLabel: "ACTIVE",
  tier: 4,
  isEarlyAdopter: true,
  earlyAdopterNumber: 412,

  // ─── Headline + meta ─────────────────────────────────────────
  headline: "Full-stack Solana engineer. 60+ minted launches.",
  timezone: "UTC+0 · LONDON",
  language: "ENGLISH",
  feeRange: "$$$$",

  // ─── Socials ─────────────────────────────────────────────────
  xHandle: "shipfast",
  xVerified: true,
  tgHandle: "shipfast",
  tgVerified: true,
  website: "shipfast.dev",
  hireTelegramHandle: "shipfast",
  isVerified: true,

  // ─── Trust tier strip ────────────────────────────────────────
  proofsConfirmed: 127,
  devProofsConfirmed: 38,
  projectsCount: 60,
  tierBarFillPct: 100,
  tierSubtitle: "127 verified proofs · TIER 4 · LEGEND",

  // ─── Categories ──────────────────────────────────────────────
  categories: [
    { slug: "solana-dev", label: "SOLANA DEV", isPrimary: true },
    { slug: "smart-contracts", label: "SMART CONTRACTS", isPrimary: false },
    { slug: "token-launcher", label: "TOKEN LAUNCHER", isPrimary: false },
  ],

  // ─── Long-form copy ──────────────────────────────────────────
  pitchBody:
    "I ship Solana programs for a living. Anchor, native Rust, token-2022, CPI wiring, mint authority lifecycle — I've done all of it, in production, for teams that paid real money and needed it live yesterday. I don't do tutorials and I don't do audits. I build, I deploy, and I hand you the keys.\n\nEvery project I've worked on is on-chain and verifiable. If you want to know what I actually shipped, look at my proofs — not my threads. The $LASTSHFT proofing system exists because devs lie about their track record. I welcomed it from day one. Every line of code I've written for a paying client is one DEV PROOF away from being public record.",
  about:
    "Solana engineer since 2021. Built the first mint program for two of the top 10 memecoins by market cap. I don't ghost, I don't miss deadlines, and I don't deploy untested code. Hire me once and you'll never hire anyone else.",
  bioStatement:
    "Solana engineer since 2021. Built the first mint program for two of the top 10 memecoins by market cap.",

  // ─── Work items ──────────────────────────────────────────────
  workItems: [
    {
      id: "wi-jup",
      ticker: "$JUP",
      role: "Mint Program Dev",
      description:
        "Built and deployed the token mint program + authority lifecycle for the launch. Full custody transfer to multisig post-mint.",
      startedAt: "NOV 2023",
      endedAt: "JAN 2024",
      isMinted: true,
      isDev: true,
      isCurrent: false,
      proofCount: 22,
      section: "minted",
    },
    {
      id: "wi-wif",
      ticker: "$WIF",
      role: "Smart Contract Lead",
      description:
        "Led the smart contract architecture for the liquidity pool and staking programs. All code open-source and audited post-launch.",
      startedAt: "MAR 2024",
      endedAt: "JUL 2024",
      isMinted: true,
      isDev: true,
      isCurrent: false,
      proofCount: 18,
      section: "minted",
    },
    {
      id: "wi-bonk",
      ticker: "$BONK",
      role: "Founder Multisig Signer",
      description:
        "One of the original 3 multisig signers. Approved every treasury transaction for the first 90 days.",
      startedAt: "JAN 2023",
      endedAt: "APR 2023",
      isMinted: true,
      isDev: true,
      isCurrent: false,
      proofCount: 15,
      section: "minted",
    },
    {
      id: "wi-lastshft",
      ticker: "$LASTSHFT",
      role: "Protocol Engineer",
      description:
        "Designing and shipping the on-chain proof-of-work minting program. Mainnet deployment targeted Q2 2026.",
      startedAt: "JAN 2026",
      endedAt: null,
      isMinted: false,
      isDev: true,
      isCurrent: true,
      proofCount: 11,
      section: "recent",
    },
    {
      id: "wi-drift",
      ticker: "$DRIFT",
      role: "Integration Dev",
      description:
        "Built perp integration helpers and CPI wrappers for an ecosystem partner. Merged upstream.",
      startedAt: "SEP 2025",
      endedAt: "DEC 2025",
      isMinted: false,
      isDev: true,
      isCurrent: false,
      proofCount: 8,
      section: "recent",
    },
  ],

  // ─── Screenshots ─────────────────────────────────────────────
  screenshots: Array.from({ length: 6 }, (_, i) => ({
    id: `ss-${i + 1}`,
    imageUrl: `https://placehold.co/1600x900/161822/ffd700?text=5K+${i + 1}`,
    previewUrl: `https://placehold.co/800x450/161822/ffd700?text=5K+${i + 1}`,
    aspectRatio: 1.78,
    caption: null,
    linkedUrl: null,
    position: i,
  })),

  // ─── Profile links ───────────────────────────────────────────
  profileLinks: [
    {
      id: "lk-1",
      label: "Main · DMs open",
      handle: "t.me/shipfast",
      url: "https://t.me/shipfast",
      platform: "tg",
      isPinned: true,
      position: 0,
    },
    {
      id: "lk-2",
      label: "Main",
      handle: "x.com/shipfast",
      url: "https://x.com/shipfast",
      platform: "x",
      isPinned: true,
      position: 1,
    },
    {
      id: "lk-3",
      label: "Portfolio",
      handle: "shipfast.dev",
      url: "https://shipfast.dev",
      platform: "web",
      isPinned: true,
      position: 2,
    },
    {
      id: "lk-4",
      label: "GitHub",
      handle: "github.com/shipfast",
      url: "https://github.com/shipfast",
      platform: "web",
      isPinned: true,
      position: 3,
    },
  ],

  recentProofs: [
    {
      id: "pf-1",
      shortWallet: "Ax7k…9Qmn",
      isDev: true,
      ticker: "$JUP",
      date: "FEB 12, 2024",
      comment: "Shipped the mint program on time, clean code",
      solscanUrl: "https://solscan.io/tx/MOCK_L1",
    },
    {
      id: "pf-2",
      shortWallet: "Bk3m…7pRx",
      isDev: true,
      ticker: "$WIF",
      date: "JUL 28, 2024",
      comment: "Absolute unit — delivered 2 weeks early",
      solscanUrl: "https://solscan.io/tx/MOCK_L2",
    },
    {
      id: "pf-3",
      shortWallet: "Cq9p…2vJt",
      isDev: true,
      ticker: "$BONK",
      date: "APR 3, 2023",
      comment: "Trustworthy multisig signer, always responsive",
      solscanUrl: "https://solscan.io/tx/MOCK_L3",
    },
  ],

  totalWorkItems: 60,
  totalProofs: 127,
  totalScreenshots: 6,
  totalLinks: 4,
  pinnedLinksCount: 4,
};
