// Sample grid-preview data for the homepage wall.
// Values lifted verbatim from wireframes/homepage.html so the section
// matches the wireframe 1:1 until live data is wired up.

export type Tier = 1 | 2 | 3 | 4;

export interface GridPreviewCard {
  initials: string;
  name: string;
  handle: string;
  verified: boolean;
  earlyAdopter: boolean; // renders the "100" / EA badge
  isDev: boolean;
  active: boolean;
  verifications: number;
  years: number;
  pitch: string;
  categories: string[]; // first = primary
  tier: Tier;
  tierLabel: "NEW" | "VERIFIED" | "EXPERIENCED" | "LEGEND";
  price: "$" | "$$" | "$$$" | "$$$$";
}

export const HOMEPAGE_CARDS: GridPreviewCard[] = [
  {
    initials: "CM",
    name: "CryptoMark",
    handle: "@cryptomark",
    verified: true,
    earlyAdopter: true,
    isDev: true,
    active: true,
    verifications: 47,
    years: 3,
    pitch:
      "Three years in the trenches of web3 marketing. Taken projects from zero to 15K organic on X, managed raid teams of 400+, and built Telegram communities people actually stay in.",
    categories: ["X Growth", "Raid Leading", "Community Mgmt"],
    tier: 4,
    tierLabel: "LEGEND",
    price: "$$$",
  },
  {
    initials: "SR",
    name: "SolRaider",
    handle: "@solraider",
    verified: true,
    earlyAdopter: false,
    isDev: false,
    active: true,
    verifications: 31,
    years: 2,
    pitch:
      "Raid specialist and community builder. 2 years on Solana. Built and scaled 3 raid communities from scratch with proven retention.",
    categories: ["Raids", "Community", "Engagement"],
    tier: 3,
    tierLabel: "EXPERIENCED",
    price: "$$",
  },
  {
    initials: "NK",
    name: "NightKOL",
    handle: "@nightkol",
    verified: true,
    earlyAdopter: true,
    isDev: false,
    active: true,
    verifications: 28,
    years: 4,
    pitch:
      "KOL manager and influencer coordinator. Connected to 200+ crypto KOLs across Twitter and Telegram. Built campaigns for 40+ launches.",
    categories: ["KOL Mgmt", "Influencer", "Partnerships"],
    tier: 3,
    tierLabel: "EXPERIENCED",
    price: "$$$$",
  },
  {
    initials: "TF",
    name: "ThreadFox",
    handle: "@threadfox",
    verified: true,
    earlyAdopter: false,
    isDev: false,
    active: true,
    verifications: 22,
    years: 2,
    pitch:
      "Long-form X threads and project breakdowns. 18M impressions across 60+ launches. Known for narrative-driven content that converts.",
    categories: ["Threads", "Content", "Storytelling"],
    tier: 2,
    tierLabel: "VERIFIED",
    price: "$$",
  },
  {
    initials: "MC",
    name: "ModCaptain",
    handle: "@modcaptain",
    verified: true,
    earlyAdopter: false,
    isDev: false,
    active: true,
    verifications: 19,
    years: 3,
    pitch:
      "24/7 chat coverage across TG and Discord. Scam filter rules, ban hammer, FUD cleanup, and new-member onboarding flows.",
    categories: ["Mod", "Discord", "Telegram"],
    tier: 2,
    tierLabel: "VERIFIED",
    price: "$",
  },
  {
    initials: "SJ",
    name: "SpaceJax",
    handle: "@spacejax",
    verified: true,
    earlyAdopter: false,
    isDev: false,
    active: true,
    verifications: 15,
    years: 1,
    pitch:
      "X Spaces host. 80+ project AMAs. Average 1.2K live listeners, full transcripts delivered within 24 hours of every session.",
    categories: ["Spaces", "AMA", "Live"],
    tier: 2,
    tierLabel: "VERIFIED",
    price: "$$",
  },
  {
    initials: "PP",
    name: "PixelPriest",
    handle: "@pixelpriest",
    verified: true,
    earlyAdopter: false,
    isDev: true,
    active: true,
    verifications: 12,
    years: 5,
    pitch:
      "Brand identity, pitch decks, meme packs. Worked on 25 Solana launches and 8 Base projects. Always ships on deadline.",
    categories: ["Brand", "Design", "Memes"],
    tier: 2,
    tierLabel: "VERIFIED",
    price: "$$$",
  },
  {
    initials: "DD",
    name: "DegenDealer",
    handle: "@degendealer",
    verified: true,
    earlyAdopter: false,
    isDev: false,
    active: true,
    verifications: 9,
    years: 2,
    pitch:
      "BD lead. CEX listings, DEX integrations, partnership outreach. 12 deals closed in 2025 including 3 top-20 exchange listings.",
    categories: ["BD", "Listings", "Partnerships"],
    tier: 1,
    tierLabel: "NEW",
    price: "$$$",
  },
];

export const OPERATOR_CATEGORIES = [
  "Community Manager",
  "Mod",
  "Raid Leader",
  "Shiller",
  "Alpha Caller",
  "KOL / Influencer",
  "Space Host / AMA Host",
  "Content Creator",
  "Collab Manager",
  "Growth / Paid Media",
  "Brand / Creative",
  "BD / Partnerships",
  "PR / Comms",
  "Vibe Coder / Builder",
  "Token Dev / Tokenomics",
];
