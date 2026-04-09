import { formatTierLabel, type Tier } from "@/lib/tier";

interface Props {
  tier: Tier;
  tierBarFillPct: number;
  tierSubtitle: string;
}

/**
 * Renders the colored tier credential strip. Tick positions are locked to
 * the wireframe (0/20/50/100). Tier label is always produced by
 * formatTierLabel so we can't drift from the "TIER N · NAME" pairing rule.
 */
export function TrustTierBar({ tier, tierBarFillPct, tierSubtitle }: Props) {
  const label = formatTierLabel(tier) ?? "UNLISTED";
  const fill = Math.max(0, Math.min(100, tierBarFillPct));
  return (
    <section className="pp-trust-tier">
      <div className="pp-tt-left">
        <div className="pp-tt-label">TRUST TIER</div>
        <div className="pp-tt-name">{label}</div>
        <div className="pp-tt-def">{tierSubtitle}</div>
      </div>
      <div className="pp-tt-right">
        <div className="pp-tt-bar">
          <div className="pp-tt-bar-base" />
          <div className="pp-tt-fill" style={{ width: `${fill}%` }} />
          <div className="pp-tt-tick" style={{ left: "0%" }}>
            <span><em>0+</em>NEW</span>
          </div>
          <div className="pp-tt-tick" style={{ left: "20%" }}>
            <span><em>10+</em>VERIFIED</span>
          </div>
          <div className="pp-tt-tick" style={{ left: "50%" }}>
            <span><em>25+</em>EXPERIENCED</span>
          </div>
          <div className="pp-tt-tick" style={{ left: "100%" }}>
            <span><em>50+</em>LEGEND</span>
          </div>
        </div>
      </div>
    </section>
  );
}
