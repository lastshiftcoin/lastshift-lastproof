/**
 * Cryptomark mock — the single fixture for Step 1 of the public profile
 * build. Values lifted verbatim from `wireframes/lastproof-profile-public.html`.
 *
 * Do NOT paraphrase copy. If the wireframe changes, update here.
 * Step 3 replaces this with a real projector read.
 */

import type { PublicProfileView } from "../public-profile-view";

export const cryptomarkProfile: PublicProfileView = {
  variant: "public",
  ownerWallet: "CRYPTOmark111111111111111111111111111111111",
  // ─── Identity ────────────────────────────────────────────────
  handle: "cryptomark",
  displayName: "CryptoMark",
  avatarUrl: null, // monogram path — matches wireframe exactly
  avatarMonogram: "C",

  // ─── State ───────────────────────────────────────────────────
  state: "active",
  statusLabel: "ACTIVE",
  tier: 3,
  // Public (non-legend) variant: no 5K founder badge.
  isEarlyAdopter: false,
  earlyAdopterNumber: null,

  // ─── Headline + meta ─────────────────────────────────────────
  headline: "Web3 growth strategist. 3 years in crypto marketing.",
  timezone: "UTC−5 · NEW YORK (EST)",
  language: "ENGLISH",
  feeRange: "$$$",

  // ─── Socials ─────────────────────────────────────────────────
  xHandle: "cryptomark",
  xVerified: true,
  tgHandle: "cryptomark",
  tgVerified: true,
  website: "cryptomark.xyz",
  hireTelegramHandle: "cryptomark",
  isVerified: true,

  // ─── Trust tier strip ────────────────────────────────────────
  proofsConfirmed: 47,
  devProofsConfirmed: 3,
  projectsCount: 50,
  tierBarFillPct: 94, // 47/50 * 100
  tierSubtitle: "47 verified proofs · 3 to TIER 4 · LEGEND",

  // ─── Categories ──────────────────────────────────────────────
  categories: [
    { slug: "launch-ops", label: "LAUNCH OPS", isPrimary: true },
    { slug: "raid-leader", label: "RAID LEADER", isPrimary: false },
    { slug: "content-creator", label: "CONTENT CREATOR", isPrimary: false },
  ],

  // ─── Long-form copy (verbatim from wireframe) ────────────────
  pitchBody:
    "I've spent the last three years in the trenches of web3 marketing — not watching from the sidelines, not theorizing on threads, actually in the group chats at 3am making sure campaigns hit. I've taken projects from zero to 15K organic followers on X, managed raid teams of 400+, and built Telegram communities that people actually stay in.\n\nWhat I bring to the table is execution. I don't need a two-week onboarding. Hand me admin, point me at the target, and let me work. I specialize in Solana projects but I've run campaigns across EVM chains too. If you need someone who's going to show up every day and move numbers, not just send a strategy deck and disappear — that's me.",
  about:
    "I run launch operations for memecoin projects on Solana. Started in gaming guilds, fell into crypto in 2022, and have been shipping campaigns for memecoin teams ever since. I focus on the first 30 days post-launch — the window where attention is everything.",
  bioStatement:
    "I run launch operations for memecoin projects on Solana. Started in gaming guilds, fell into crypto in 2022, and have been shipping campaigns for memecoin teams ever since. I focus on the first 30 days post-launch — the window where attention is everything.",
  previousHandles: ["CryptoMarkOG", "MarkTheShiller"],

  // ─── Work items ──────────────────────────────────────────────
  workItems: [
    {
      id: "wi-eth",
      ticker: "$ETH",
      role: "Growth Lead",
      description:
        "Led community growth campaign for Ethereum ecosystem project. Managed 50+ KOL partnerships.",
      startedAt: "JAN 2023",
      endedAt: "AUG 2023",
      isMinted: true,
      isDev: true,
      isCurrent: false,
      proofCount: 12,
      section: "minted",
    },
    {
      id: "wi-sol",
      ticker: "$SOL",
      role: "Marketing Director",
      description:
        "Directed full marketing operations for major Solana launch. 0 to 25K X followers in 4 months.",
      startedAt: "SEP 2023",
      endedAt: "MAR 2024",
      isMinted: true,
      isDev: true,
      isCurrent: false,
      proofCount: 8,
      section: "minted",
    },
    {
      id: "wi-bonk",
      ticker: "$BONK",
      role: "Raid Commander",
      description:
        "Organized and led 400-person raid team. Consistently hit engagement targets across 3 month campaign.",
      startedAt: "MAY 2024",
      endedAt: "SEP 2024",
      isMinted: true,
      isDev: true,
      isCurrent: false,
      proofCount: 9,
      section: "minted",
    },
    {
      id: "wi-lastshft",
      ticker: "$LASTSHFT",
      role: "X Growth Lead",
      description:
        "Managing full X growth strategy. Organic engagement, content calendar, raid coordination, KOL outreach.",
      startedAt: "FEB 2026",
      endedAt: null,
      isMinted: false,
      isDev: true,
      isCurrent: true,
      proofCount: 9,
      section: "recent",
    },
    {
      id: "wi-phantom",
      ticker: "$PHANTOM",
      role: "Community Manager",
      description:
        "Built and managed TG community. 2K to 18K followers on X. Moderation, engagement strategy, AMA coordination.",
      startedAt: "OCT 2025",
      endedAt: "JAN 2026",
      isMinted: false,
      isDev: false,
      isCurrent: false,
      proofCount: 7,
      section: "recent",
    },
    {
      id: "wi-sffloor",
      ticker: "$SFFLOOR",
      role: "Growth Strategist",
      description:
        "Full-stack marketing for SolanaFloor ecosystem. X threads, TG growth, influencer coordination.",
      startedAt: "JUN 2025",
      endedAt: "SEP 2025",
      isMinted: false,
      isDev: false,
      isCurrent: false,
      proofCount: 5,
      section: "recent",
    },
    {
      id: "wi-degods",
      ticker: "$DEGODS",
      role: "KOL Coordinator",
      description:
        "Managed network of 30+ KOLs. Scheduled posts, negotiated rates, tracked engagement metrics.",
      startedAt: "FEB 2025",
      endedAt: "MAY 2025",
      isMinted: false,
      isDev: false,
      isCurrent: false,
      proofCount: 4,
      section: "recent",
    },
    {
      id: "wi-orca",
      ticker: "$ORCA",
      role: "Content Lead",
      description:
        "Wrote daily threads, managed content pipeline, coordinated with design team for visual assets.",
      startedAt: "OCT 2024",
      endedAt: "JAN 2025",
      isMinted: false,
      isDev: false,
      isCurrent: false,
      proofCount: 2,
      section: "recent",
    },
  ],

  // ─── Screenshots (placeholders for Step 1) ───────────────────
  screenshots: Array.from({ length: 6 }, (_, i) => ({
    id: `ss-${i + 1}`,
    imageUrl: `https://placehold.co/1600x900/161822/ff9100?text=SS+${i + 1}`,
    previewUrl: `https://placehold.co/800x450/161822/ff9100?text=SS+${i + 1}`,
    aspectRatio: 1.78,
    caption: null,
    linkedUrl: null,
    position: i,
  })),

  // ─── Profile links (9 total, 6 pinned — verbatim) ───────────
  profileLinks: [
    {
      id: "lk-1",
      label: "Main · DMs open",
      handle: "t.me/cryptomark",
      url: "https://t.me/cryptomark",
      platform: "tg",
      isPinned: true,
      position: 0,
    },
    {
      id: "lk-2",
      label: "Main",
      handle: "x.com/cryptomark",
      url: "https://x.com/cryptomark",
      platform: "x",
      isPinned: true,
      position: 1,
    },
    {
      id: "lk-3",
      label: "Portfolio",
      handle: "cryptomark.xyz",
      url: "https://cryptomark.xyz",
      platform: "web",
      isPinned: true,
      position: 2,
    },
    {
      id: "lk-4",
      label: "BONK shillers",
      handle: "t.me/bonk_shillers",
      url: "https://t.me/bonk_shillers",
      platform: "tg",
      isPinned: true,
      position: 3,
    },
    {
      id: "lk-5",
      label: "WIF squad",
      handle: "t.me/wifsquad",
      url: "https://t.me/wifsquad",
      platform: "tg",
      isPinned: true,
      position: 4,
    },
    {
      id: "lk-6",
      label: "Alt — degen",
      handle: "x.com/markdegen",
      url: "https://x.com/markdegen",
      platform: "x",
      isPinned: true,
      position: 5,
    },
    {
      id: "lk-7",
      label: "PEPE narrative chat",
      handle: "t.me/pepenarrative",
      url: "https://t.me/pepenarrative",
      platform: "tg",
      isPinned: false,
      position: 6,
    },
    {
      id: "lk-8",
      label: "Project burner",
      handle: "x.com/markburner",
      url: "https://x.com/markburner",
      platform: "x",
      isPinned: false,
      position: 7,
    },
    {
      id: "lk-9",
      label: "Server — closed",
      handle: "discord.gg/cryptomark",
      url: "https://discord.gg/cryptomark",
      platform: "dc",
      isPinned: false,
      position: 8,
    },
  ],

  // ─── Recent proofs (5 rows, verbatim) ────────────────────────
  recentProofs: [
    {
      id: "pf-1",
      shortWallet: "9pQ7…xN2j",
      isDev: true,
      ticker: "$LASTSHFT",
      date: "MAR 20, 2026",
      comment: "Consistent execution every single day",
      solscanUrl: "https://solscan.io/tx/MOCK_1",
    },
    {
      id: "pf-2",
      shortWallet: "3kM8…pR4v",
      isDev: false,
      ticker: "$LASTSHFT",
      date: "MAR 18, 2026",
      comment: "Great raid coordinator, always on time",
      solscanUrl: "https://solscan.io/tx/MOCK_2",
    },
    {
      id: "pf-3",
      shortWallet: "7xK3…nF8q",
      isDev: false,
      ticker: "$PHANTOM",
      date: "JAN 15, 2026",
      comment: "Delivered exactly what was promised",
      solscanUrl: "https://solscan.io/tx/MOCK_3",
    },
    {
      id: "pf-4",
      shortWallet: "4pN2…jK7m",
      isDev: false,
      ticker: "$PHANTOM",
      date: "DEC 28, 2025",
      comment: "Grew our TG from nothing",
      solscanUrl: "https://solscan.io/tx/MOCK_4",
    },
    {
      id: "pf-5",
      shortWallet: "6tR8…wQ3x",
      isDev: false,
      ticker: "$SFFLOOR",
      date: "SEP 10, 2025",
      comment: null,
      solscanUrl: "https://solscan.io/tx/MOCK_5",
    },
  ],

  // ─── Counts ──────────────────────────────────────────────────
  // NOTE: wireframe literally renders "8 SHOWN · 47 TOTAL" in the PoW
  // section title — not 50. Mirroring verbatim per handoff rule.
  viewCount: 1_342,
  totalWorkItems: 47,
  totalProofs: 47,
  totalScreenshots: 6,
  totalLinks: 9,
  pinnedLinksCount: 6,
};
