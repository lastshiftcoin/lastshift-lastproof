"use client";

/**
 * LegendCtaSwitch — renders FomoCtaStrip during the 5000 campaign,
 * falls back to the regular CtaStrip when the campaign is sold out.
 */

import { useCampaignCounter } from "@/hooks/useCampaignCounter";
import { FomoCtaStrip } from "./FomoCtaStrip";
import { CtaStrip } from "./CtaStrip";

export function LegendCtaSwitch() {
  const { soldOut } = useCampaignCounter(true);

  if (soldOut) return <CtaStrip />;
  return <FomoCtaStrip />;
}
