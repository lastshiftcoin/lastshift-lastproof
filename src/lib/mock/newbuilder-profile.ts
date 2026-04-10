/**
 * Newbuilder mock — fixture for the FREE / unclaimed variant.
 *
 * Free profiles render a stripped-down layout: hero + single CTA strip.
 * No tier bar, tabs, stats, PoW, screenshots, links, about, or verifications.
 * The hero shows a `> UPGRADE PROFILE` button (→ /manage) since the user
 * onboarded but never paid. No proof-modal connectivity is wired for this
 * variant — there are no work items to verify.
 *
 * Lifted from `wireframes/lastproof-profile-free.html`.
 */

import type { PublicProfileView } from "../public-profile-view";

export const newbuilderProfile: PublicProfileView = {
  variant: "free",
  ownerWallet: "NEWbuilder11111111111111111111111111111111111",

  // ─── Identity ────────────────────────────────────────────────
  handle: "newbuilder",
  displayName: "NewBuilder",
  avatarUrl: null,
  avatarMonogram: "N",

  // ─── State ───────────────────────────────────────────────────
  state: "none",
  statusLabel: "NON-ACTIVE",
  tier: 5 as unknown as PublicProfileView["tier"], // sentinel per CLAUDE.md — free = not on the ladder
  isEarlyAdopter: false,
  earlyAdopterNumber: null,

  // ─── Headline + meta ─────────────────────────────────────────
  headline: "Web3 growth strategist. 3 years in crypto marketing.",
  timezone: "UTC−5 · NEW YORK (EST)",
  language: "ENGLISH",
  feeRange: "$$$",

  // ─── Socials — free profiles render NONE of these ───────────
  xHandle: null,
  xVerified: false,
  tgHandle: null,
  tgVerified: false,
  website: null,
  hireTelegramHandle: null,
  isVerified: false,

  // ─── Everything below is unused by the free variant ──────────
  proofsConfirmed: 0,
  devProofsConfirmed: 0,
  projectsCount: 0,
  tierBarFillPct: 0,
  tierSubtitle: "",

  categories: [],
  pitchBody: "",
  about: "",
  bioStatement: "",

  workItems: [],
  screenshots: [],
  profileLinks: [],
  recentProofs: [],

  totalWorkItems: 0,
  totalProofs: 0,
  totalScreenshots: 0,
  totalLinks: 0,
  pinnedLinksCount: 0,
};
