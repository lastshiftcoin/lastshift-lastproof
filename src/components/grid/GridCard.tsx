"use client";

import type { GridCardView } from "@/lib/grid/grid-view";

const TIER_NAME: Record<number, string> = {
  1: "NEW",
  2: "VERIFIED",
  3: "EXPERIENCED",
  4: "LEGEND",
};

/**
 * Computes the avatar gradient variant index. We rotate through 10 visually
 * distinct gradients keyed off the handle so the same operator always gets
 * the same avatar color. Stable across re-renders.
 */
function avatarVariant(handle: string): number {
  let hash = 0;
  for (let i = 0; i < handle.length; i++) {
    hash = (hash * 31 + handle.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 10) + 1;
}

/**
 * One operator card. Click anywhere on the card opens /@<handle> in a new
 * tab (per Kellen's lock — never same-tab navigation, never a modal).
 */
export default function GridCard({ card }: { card: GridCardView }) {
  const tierName = TIER_NAME[card.tier];
  const av = avatarVariant(card.handle);
  return (
    <a
      className="g-card"
      href={`/@${card.handle}`}
      target="_blank"
      rel="noopener"
    >
      <div className="g-card-grid">
        <div className="g-avatar" data-av={av}>
          {card.avatarMonogram}
        </div>
        <div className="g-card-main">
          <div className="g-card-topline">
            <span className="g-card-name">{card.displayName}</span>
            {card.isVerified && <span className="g-check" aria-label="Verified" />}
            <span className="g-active-pill">
              <span className="dot" />
              Active
            </span>
          </div>
          <div className="g-card-meta">
            <span className="m">
              <b>{card.proofsConfirmed}</b> proofs
            </span>
            <span className="sep">·</span>
            {card.devProofsConfirmed > 0 ? (
              <span className="m green">
                <b>{card.devProofsConfirmed}</b>
                <span className="dev-mini">DEV</span>
              </span>
            ) : (
              <span className="m">
                <b>0</b> DEV
              </span>
            )}
            <span className="sep">·</span>
            <span className="m">
              <b>{card.projectsCount}</b> projects
            </span>
            <span className="sep">·</span>
            <span className="m">{card.timezone}</span>
            <span className="sep">·</span>
            <span className="m">{card.language}</span>
          </div>
          <p className="g-card-pitch">{card.pitch}</p>
          <div className="g-card-cats">
            {card.categories.map((c, i) => (
              <span
                key={c.slug}
                className={`g-card-cat${i === 0 ? " primary" : ""}`}
              >
                {c.label}
              </span>
            ))}
          </div>
          {/* Mobile-only foot: tier + fee + view stacked beneath the content */}
          <div className="g-card-mobile-foot">
            <span className="g-tier-pill" data-tier={card.tier}>
              TIER {card.tier}
              <small>· {tierName}</small>
            </span>
            <FeeDisplay fee={card.feeRange} />
            <span className="g-card-view">&gt; view</span>
          </div>
        </div>
        {/* Desktop right rail */}
        <div className="g-card-right">
          <span className="g-tier-pill" data-tier={card.tier}>
            TIER {card.tier}
            <small>· {tierName}</small>
          </span>
          <FeeDisplay fee={card.feeRange} />
          <span className="g-card-view">&gt; view</span>
        </div>
      </div>
    </a>
  );
}

/**
 * Fee display: filled glyphs for the operator's fee tier, dim glyphs for
 * the remaining "unused" range. e.g. "$$$" with feeRange="$$" renders as
 * `$$<dim>$$</dim>`.
 *
 * The `data-fee` attribute lets the CSS color $$$$ in gold (premium tier
 * highlight) without needing a separate component variant.
 */
function FeeDisplay({ fee }: { fee: "$" | "$$" | "$$$" | "$$$$" }) {
  const filled = fee.length;
  const dim = 4 - filled;
  return (
    <span className="g-card-fee" data-fee={fee}>
      {"$".repeat(filled)}
      {dim > 0 && <span className="dim">{"$".repeat(dim)}</span>}
    </span>
  );
}
