"use client";

/**
 * CampaignFomoStrip — dashboard FOMO strip shown below the StatusBar
 * during the first-5,000 campaign.
 *
 * Uses the shared 3-phase campaign counter hook. Behavior:
 *   - Active campaign: orange strip with live counter + "$0" badge
 *   - Sold out: strip turns red, "EARLY ACCESS · CLOSED", then
 *     disappears after 15-20s auto-refresh
 *   - Post-campaign: not rendered at all
 */

import { useEffect, useRef, useState } from "react";
import { useCampaignCounter, TOTAL_SPOTS } from "@/hooks/useCampaignCounter";

interface CampaignFomoStripProps {
  /** Callback to notify parent that campaign just sold out (disables upgrade button) */
  onSoldOut?: () => void;
}

const SOLD_OUT_KEY = "campaign_5000_sold_out";

export function CampaignFomoStrip({ onSoldOut }: CampaignFomoStripProps) {
  // If we already detected sold out in this session, don't render at all —
  // prevents infinite reload loop (strip renders → detects sold out → reloads → repeat)
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SOLD_OUT_KEY) === "1";
  });

  const { spots, soldOut, filledPct, isLowStock } = useCampaignCounter(!dismissed);
  const notifiedRef = useRef(false);

  // Notify parent + schedule auto-refresh when sold out
  useEffect(() => {
    if (!soldOut || notifiedRef.current) return;
    notifiedRef.current = true;

    // Persist so the strip doesn't re-appear after the auto-refresh
    sessionStorage.setItem(SOLD_OUT_KEY, "1");

    // Notify parent to disable upgrade button
    onSoldOut?.();

    // Auto-refresh page 15-20s after sold out — clears the FOMO strip
    // and restores normal paid upgrade experience
    const delay = 15000 + Math.random() * 5000;
    const timer = setTimeout(() => {
      setDismissed(true);
      window.location.reload();
    }, delay);
    return () => clearTimeout(timer);
  }, [soldOut, onSoldOut]);

  // Already handled — strip is gone, normal upgrade UI takes over
  if (dismissed) return null;

  // Sold-out state: red strip briefly visible before auto-refresh
  if (soldOut) {
    return (
      <div className="campaign-fomo-strip campaign-fomo-soldout">
        <div className="cfs-top">
          <div className="cfs-badge">
            <span className="cfs-dot" />
            EARLY ACCESS · CLOSED
          </div>
          <div className="cfs-price-gone">ALL 5,000 SPOTS CLAIMED</div>
        </div>
        <div className="cfs-counter-row">
          <span className="cfs-counter-label">FREE SPOTS REMAINING</span>
          <span className="cfs-counter-num">
            <span className="cfs-num-big">0</span> / {TOTAL_SPOTS.toLocaleString()}
          </span>
        </div>
        <div className="cfs-bar">
          <div className="cfs-bar-fill cfs-bar-full" style={{ width: "100%" }} />
        </div>
        <div className="cfs-foot">
          <b>0</b> SPOTS LEFT — EARLY ACCESS HAS CLOSED
        </div>
      </div>
    );
  }

  // Active campaign
  return (
    <div className="campaign-fomo-strip">
      <div className="cfs-top">
        <div className="cfs-badge">
          <span className="cfs-dot" />
          {isLowStock ? "EARLY ACCESS · CLOSING SOON" : "EARLY ACCESS · FIRST 5,000 OPERATORS"}
        </div>
        <div className="cfs-price">
          CLICK UPGRADE PROFILE — <b>$0</b>
        </div>
      </div>
      <div className="cfs-counter-row">
        <span className="cfs-counter-label">FREE SPOTS REMAINING</span>
        <span className="cfs-counter-num">
          <span className="cfs-num-big">{spots.toLocaleString()}</span> / {TOTAL_SPOTS.toLocaleString()}
        </span>
      </div>
      <div className="cfs-bar">
        <div
          className="cfs-bar-fill"
          style={{ width: `${Math.min(filledPct, 100).toFixed(2)}%` }}
        />
      </div>
      <div className="cfs-foot">
        <b>{spots.toLocaleString()}</b> SPOTS LEFT BEFORE EARLY ACCESS CLOSES
      </div>
    </div>
  );
}
