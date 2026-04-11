import Link from "next/link";
import type { GridPreviewCard } from "@/lib/homepage-data";

/**
 * Grid result card — matches wireframes/homepage.html .result-card.
 * Tier number is ALWAYS paired with its word label via · (handoff §3 rule).
 */
export default function ResultCard({ card }: { card: GridPreviewCard }) {
  return (
    <Link className="result-card" href="/manage">
      {card.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="result-avatar result-avatar-img" src={card.avatarUrl} alt={card.name} />
      ) : (
        <div className="result-avatar">{card.initials}</div>
      )}
      <div className="result-info">
        <div className="result-name-row">
          <span className="result-name">{card.name}</span>
          {card.verified && <span className="result-check">✓</span>}
          {card.earlyAdopter && <span className="result-badge-100">EA</span>}
          {card.isDev && <span className="dev-badge">DEV</span>}
          {card.active && <span className="result-status active">ACTIVE</span>}
        </div>
        <div className="result-meta">
          <span>{card.handle}</span>
          <span className="dot">·</span>
          <span className="verif-count">{card.verifications} verifications</span>
          <span className="dot">·</span>
          <span>
            {card.years} yr{card.years === 1 ? "" : "s"}
          </span>
        </div>
        <div className="result-pitch">{card.pitch}</div>
        <div className="result-cats">
          {card.categories.map((c, i) => (
            <span key={c} className={`result-cat${i === 0 ? " primary" : ""}`}>
              {c}
            </span>
          ))}
        </div>
      </div>
      <div className="result-right">
        <span className={`result-tier t${card.tier}`}>
          TIER {card.tier}
          <br />
          <small>· {card.tierLabel}</small>
        </span>
        <span className="result-price">{card.price}</span>
        <span className="result-cmd">&gt; view</span>
      </div>
    </Link>
  );
}
