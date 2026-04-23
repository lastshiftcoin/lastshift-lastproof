# LASTPROOF — Builder Handoff (v1.0)

Everything the Next.js builder needs to ship LASTPROOF v1.0 faithfully to the wireframes.

---

## 1. What to build (in scope)

| # | Wireframe | Purpose | Route |
|---|---|---|---|
| 1 | `homepage.html` | Marketing homepage — hero, SHIFTBOT demo, tier explainer, profile previews, CTA | `/` |
| 2 | `homepage-with-popup.html` | Homepage with first-5000 modal overlay (landing from campaign) | `/?promo=5000` |
| 3 | `how-it-works.html` | Long-form explainer with DEV/OPERATOR dual pane | `/how-it-works` |
| 4 | `lastproof-profile-public.html` | Canonical public profile (paid/active) | `/@[handle]` |
| 5 | `lastproof-profile-5000.html` | Public profile + FOMO strip (first-5000 state) | `/@[handle]` (same route, state switch) |
| 6 | `lastproof-profile-free.html` | Stripped free tier — no verification, no hire, no links, no tier section | `/@[handle]` (same route, free state) |
| 7 | `lastproof-dashboard.html` | Operator dashboard — tier ladder, proofs, stats, SHIFTBOT feed (populated state) | `/dashboard` |
| 7b | `lastproof-dashboard-fresh.html` | Same dashboard immediately post-onboarding — only onboarding fields populated, every other component shows an inline empty-state prompt | `/dashboard` (first-login state) |
| 8 | `lastproof-onboarding.html` | First-run interrupt (boot-screen gate) | `/dashboard` entry modal |
| 9 | `manage-profile.html` | Wallet connect manage flow | `/manage` |
| 10 | `manage-profile-dashboard-entry.html` | Entering-dashboard boot reveal | `/dashboard` entry |
| 11 | `manage-profile-no-terminal.html` | No Terminal ID gate | `/manage` (missing-key state) |
| 12 | `manage-profile-safety.html` | Wallet safety explainer | `/manage/safety` |
| 13 | `popup-5000.html` | First-5000 modal (source of modal chrome) | Component |
| 14 | `scan-grid-locked.html` | **Locked Grid placeholder** — stands in for the real Grid until v1.1 | `/grid` |

**The Grid is intentionally NOT built yet.** `scan-grid-locked.html` is the v1.0 solution: it lives at `/grid` and shows a locked/coming-soon state. This buys us time to collect profiles via the first-5000 campaign before we wireframe and ship the real Grid. Payment flow will be wireframed with the builder directly in a later round.

---

## 2. Design tokens (single source of truth)

Use these as Tailwind config / CSS vars:

```css
:root {
  /* COLORWAY */
  --bg-primary:    #0a0b0f;   /* page */
  --bg-secondary:  #12131a;   /* hero cards */
  --bg-card:       #161822;   /* interior */
  --bg-card-hover: #1a1d2a;
  --bg-input:      #0e0f16;
  --border:        #1e2030;
  --border-2:      #2a2d3f;

  /* TEXT */
  --text-primary:   #e2e4ed;
  --text-secondary: #8b8fa3;
  --text-dim:       #5a5e73;

  /* BRAND ACCENTS */
  --orange: #ff9100;   /* = --accent, the primary brand color */
  --green:  #00e676;   /* success, DEV badge, verified, "money" */
  --gold:   #ffd700;   /* Tier 3 — EXPERIENCED */
  --purple: #a78bfa;   /* Tier 4 — LEGEND */
  --silver: #9ca3af;   /* Tier 1 — NEW */
  --bronze: #cd7f32;   /* Tier 2 — VERIFIED */
  --red:    #ff5470;   /* errors, red-flag callouts */
  --blue:   #409eff;   /* hire CTA secondary */

  /* FONTS */
  --sans: "Inter", -apple-system, system-ui, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;

  /* RADIUS */
  --r-sm:   3px;
  --r-btn:  6px;
  --r-card: 10px;
  --r-pill: 999px;
}
```

---

## 3. The Tier System (LOCKED)

Four tiers. No 5-tier legacy. Thresholds are **proofs** (on-chain mints):

| Tier | Label | Proofs | Color | Token |
|---|---|---|---|---|
| TIER 1 | NEW | 0+ | Silver `#9ca3af` | `--silver` |
| TIER 2 | VERIFIED | 10+ | Bronze `#cd7f32` | `--bronze` |
| TIER 3 | EXPERIENCED | 25+ | **Gold** `#ffd700` | `--gold` |
| TIER 4 | LEGEND | 50+ | Purple `#a78bfa` | `--purple` |

Rules:
- Never use green for a tier label. Green is reserved for DEV badge, verified state, and money.
- Never use orange for a tier label. Orange is the brand accent only.
- The heat-map tier progress bar base uses all four colors as a gradient (`silver → bronze → gold → purple`); the fill is a saturated `silver → bronze → gold` gradient that stops at the user's current proof %.
- No color nomenclature in copy. Always use TIER 1/2/3/4 and the label (NEW/VERIFIED/EXPERIENCED/LEGEND). Never "GOLD TIER" or "BRONZE LEVEL".
- **Tier name pairing rule:** wherever a tier number appears in UI (badges, ladder steps, "next tier" callouts, progress-bar tick labels, public-profile hero), it must be rendered with its word name using the `·` separator — `TIER 1 · NEW`, `TIER 2 · VERIFIED`, `TIER 3 · EXPERIENCED`, `TIER 4 · LEGEND`. The number alone is never shown in isolation.

---

## 4. Brand elements (treat these as trademarks)

### 4.1 Wordmark — `LAST(white)PROOF(orange)`
Always two-tone when rendered as a display title or topbar brand. CSS:
```css
.topbar-brand { font-family: var(--mono); font-weight:700; letter-spacing:2px; }
.topbar-brand .last  { color: var(--text-primary); }
.topbar-brand .proof { color: var(--orange); }
```
```html
<div class="topbar-brand"><span class="last">LAST</span><span class="proof">PROOF</span></div>
```

In body prose it can be written as `LASTPROOF` (all-caps, single color).

### 4.2 Section label `// EYEBROW`
Tiny mono eyebrow above every section title. The `//` is orange:
```css
.section-label{
  font-family:var(--mono); font-size:10px; color:var(--text-dim);
  letter-spacing:2.5px; text-transform:uppercase; display:flex; align-items:center; gap:10px;
}
.section-label::before{ content:"//"; color:var(--orange); }
```

### 4.3 SHIFTBOT logo pin
Always top-left. Use `shiftbot-logo.png` at 28–32px height. On Terminal boot screens, precedes the page-name line.

### 4.4 Footer (universal LASTSHIFT rule)
Left-aligned: `lastshift.ai, a company of vibe coders`

---

## 5. Typography rules

| Element | Font | Size | Weight | Color | Transform |
|---|---|---|---|---|---|
| Page h1 (hero) | sans | 32–48px | 800 | `--text-primary` | — |
| Section h2 | sans | 26–32px | 700 | `--text-primary` | — |
| Card title | sans | 15–18px | 700 | `--text-primary` | — |
| Body | sans | 14–15px | 400 | `--text-secondary` | — |
| Small label / eyebrow | mono | 10–11px | 700 | `--text-dim` | uppercase, letter-spacing 2–2.5px |
| Ticker / code / value | mono | 12–16px | 700 | `--green` | — |
| Nav / button | mono | 11–13px | 700 | varies | uppercase, letter-spacing 1–2px |

- Tickers (`$BONK`, `$SOL`) = green with subtle glow — "green for money".
- All-caps reserved for mono labels and buttons. Never all-caps in sans body copy.

---

## 6. Component conventions

### Buttons
Three shapes, all using `border-radius: var(--r-btn)` (6px):
1. **Primary** — orange fill or orange border, mono, `> LABEL`
2. **Secondary/Blue** — blue border, used for HIRE
3. **Ghost** — transparent, 1px border var(--border)

Never mix rounded-full and rounded-6 buttons in the same section. Pill shape only for status chips.

### Status pills
Rounded-full, mono 10px, letter-spacing 1.5px:
- `ACTIVE` (green dot)
- `PENDING` / `DEFUNCT` (amber/red)

### Cards / panels
- Background: `--bg-secondary` on `--bg-primary` page
- Border: 1px solid `--border`
- Radius: `--r-card` (10px)
- Padding: 24–36px desktop, 20–24px mobile

### Modals / popups
All popups inherit the `popup-5000.html` chrome:
- Titlebar with red/yellow/green dots (LASTSHIFT Terminal window chrome)
- Scanline overlay
- Subtle grid background
- Mono CTA button

### Boot screens / gates
All tools reuse the Terminal `/connect` cold-boot as entry gate. Manage flows (`manage-profile-*`) follow this pattern — SHIFTBOT ASCII logo, `LASTPROOF v1.0 // [PAGE]` label, reveal lines with cursor.

---

## 7. Mobile-first notes for the builder

Every wireframe was designed desktop-first but includes at least one `@media (max-width:760px)` breakpoint. When rebuilding in Next.js:

1. **Go mobile-first** — flip the cascade. Use the desktop CSS as the `md:` / `lg:` variants.
2. **Hero sections** — avatar and text stack on mobile (`grid-template-columns: 1fr`).
3. **Tier ladder** — 4-column grid on desktop collapses to 2×2 on mobile. Tick labels shrink to 8–9px.
4. **Stat boxes (Proofs / Dev / Projects / Fee)** — 4 columns → 2×2 on mobile.
5. **SHIFTBOT strip** — fixed bottom, full width, label wraps or truncates on narrow screens.
6. **POW cards** — horizontal ticker+role layout becomes vertical stack on mobile (already done in wireframes).
7. **Tabs (`OVERVIEW / WORK / PROOFS / LINKS`)** — horizontal scroll with overflow-x: auto on mobile.
8. **Lightbox** — ensure touch swipe (left/right) to navigate in addition to the arrows.

Touch targets: minimum 44×44px for any clickable element. Many wireframe buttons are smaller (32–36px) — scale them up on mobile.

---

## 8. Copy / messaging (check these for discrepancy)

Canonical lines — use these verbatim where they appear. Don't invent variations.

- **Tagline:** "The Trusted Web3 Marketers Are on **LASTPROOF**"
- **SHIFTBOT elevator:** "Don't scroll 1,000 profiles. Ask."
- **Tier line:** "Every operator carries a tier. Earned, not bought."
- **Trust claim:** "No pay-to-rank. No stake-to-boost. Only work counts."
- **Verified means:** "X + Telegram linked to the same wallet that signs every proof."
- **Pricing (first-5000):** "$0 until 30 days after Grid launch, then $10/mo. Only the first 5,000 get the head start."
- **FOMO trust line:** "NO CREDIT CARD · NO EMAIL · JUST YOUR SOLANA WALLET"
- **CTA verbs:** Use `> BUILD YOUR PROFILE` (operators) and `> HIRE AN OPERATOR` (devs/teams). `LAUNCH` is reserved for Terminal tools only.
- **Never say:** "free forever", "free for life", "pay-what-you-want", "grandfathered" (we say "head start" instead).

---

## 9. Consistency fixes applied in this review

- **Tier 3 color**: unified to **gold** (`#ffd700`) across `homepage.html`, `homepage-with-popup.html`, `how-it-works.html`. Previously was green in grid preview results.
- **Tier 4 color**: unified to **purple** across the same files. Previously orange.
- **Legacy 5-tier system (`t5`)** removed from homepage/how-it-works CSS. Only 4 tiers exist.
- **Tier 4 label**: "TRUSTED" → "LEGEND" on homepage grid preview.
- **DEV badge**: unified to **green** on homepage, homepage-with-popup, how-it-works (`.dev-badge`, `.mp-badge.dev`, `.unfurl-pill.d`, `.gc-pill.d`). Previously orange in several places.
- **Tier pill in inline text** (`.mp-badge.tier`, `.unfurl-pill.t`, `.gc-pill.t`): unified to gold. Previously green.
- **How-it-works page**: added Trust Tier highlighted section between SHIFTBOT and "What to Look For" (heat-map progress bar, 4 tier cards).
- **Free profile**: stripped to bare identity (avatar, name, handle, bio, timezone, language) + glowing green `UPGRADE PROFILE` button + transparent dashed-border CTA banner at bottom for contrast against the hero.
- **Dead lightbox/tabs JS** removed from free profile (was throwing `null.addEventListener`).
- **Grid placeholder (`scan-grid-locked.html`)** confirmed in scope for v1.0 as the `/grid` route — serves as the locked stand-in until the real Grid is wireframed.
- **Fresh dashboard state (`lastproof-dashboard-fresh.html`)**: post-onboarding empty-state version of the operator dashboard. Clones the real dashboard component-for-component but only carries the values captured in onboarding (handle, display name, primary category, region, language, one-liner). Every other field, list, and stat is replaced with an inline empty-state prompt inside its existing component, so the operator can see exactly what to fill in next. First login timestamp + `· NEW` crumb in the page title. X verification row defaults to disconnected (CONNECT button). Previous-handle input shows `@markthedegen` as a placeholder, not a value.
- **Tier word names propagated**: every tier surface now pairs the number with its word name (`TIER 1 · NEW`, `TIER 2 · VERIFIED`, `TIER 3 · EXPERIENCED`, `TIER 4 · LEGEND`). Applied across: dashboard tier ladder + badge XL + "next tier" pills, dashboard-fresh tier ladder, public profile + 5000 profile hero `tt-name` + `tt-def` + progress-bar tick labels, how-it-works Trust Tier showcase progress-bar ticks. Homepage and homepage-with-popup grid result chips already carried the names. Free profile has no tier section by design.

---

## 10. What the builder still needs (future rounds)

1. **Payment flow** — checkout, Solana Pay, receipt, tier-upgrade path. Will be wireframed with the builder directly.
2. **The Grid** — full scan/filter/sort page. Will be wireframed after first 5000 profiles are collected.
3. **Messaging / DM system** — post-hire communication, out of scope.
4. **Admin tools** — badge revocation, abuse reports, out of scope.

---

## 11. File inventory

```
lastproof-build/
├── LASTPROOF-BUILDER-HANDOFF.md          ← this file
└── wireframes/
    ├── homepage.html                      (marketing homepage)
    ├── homepage-with-popup.html           (homepage + 5000 modal)
    ├── how-it-works.html                  (long-form explainer, dev+op panes)
    ├── lastproof-profile-public.html      (canonical profile)
    ├── lastproof-profile-5000.html        (profile + FOMO banner)
    ├── lastproof-profile-free.html        (free tier profile)
    ├── lastproof-dashboard.html           (operator dashboard — populated)
    ├── lastproof-dashboard-fresh.html     (operator dashboard — first-login empty state)
    ├── lastproof-onboarding.html          (first-run interrupt)
    ├── manage-profile.html                (wallet connect manage)
    ├── manage-profile-dashboard-entry.html
    ├── manage-profile-no-terminal.html    (missing Terminal ID)
    ├── manage-profile-safety.html         (wallet safety explainer)
    ├── popup-5000.html                    (modal chrome source)
    ├── scan-grid-locked.html              (/grid locked placeholder — v1.0)
    ├── cryptoMark.jpg                     (avatar asset)
    ├── ba-after.jpg, ba-before.jpg        (before/after assets)
    └── shiftbot-logo.png                  (SHIFTBOT mark)
```

---

## 12. Golden rules (don't violate)

1. Wordmark is always `LAST` white + `PROOF` orange when displayed as a title.
2. `//` in section eyebrows is always orange.
3. Tier 3 = gold. DEV = green. Never swap.
4. Green = money / verified / success. Orange = brand / CTAs. Gold = Tier 3 only. Purple = Tier 4 only.
5. Mono font for labels/buttons/tickers. Sans for headings and body.
6. Every page has the SHIFTBOT logo top-left and the LASTSHIFT footer bottom-left.
7. Mobile first. Touch targets ≥ 44px.
8. Never pre-check consent. Never auto-submit. Wallet actions always require user click.
9. Do not build the real Grid yet — ship `scan-grid-locked.html` at `/grid` as the v1.0 placeholder.
10. When in doubt, open the wireframe and match it pixel-for-pixel.
