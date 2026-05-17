"use client";

/**
 * FomoCtaStrip — footer CTA for the LEGEND / founding-5000 variant.
 *
 * Uses the shared 3-phase campaign counter. When sold out, this strip
 * disappears entirely — the early access experience is over.
 *
 * Structural source: `wireframes/lastproof-profile-5000.html` lines ~786–814.
 * Purple border + green price card + orange urgency counter + pulsing CTA.
 *
 * The "BUILD YOUR PROFILE" button links to the profile owner's campaign
 * page if they're an ambassador, otherwise to /manage.
 */

import { useCampaignCounter } from "@/hooks/useCampaignCounter";

export function FomoCtaStrip({ campaignSlug }: { campaignSlug?: string | null }) {
  // Still consult the counter so the entire strip disappears once the
  // 5,000 cap is hit — but the depleting "X SPOTS LEFT" widget itself
  // was removed on 2026-05-16 (phishing-classifier urgency-pattern
  // mitigation). The hook's `soldOut` is the only field we now read.
  const { soldOut } = useCampaignCounter(true);

  // Strip disappears completely when sold out
  if (soldOut) return null;

  return (
    <section className="pp-cta-strip pp-fomo-strip">
      <div className="pp-fomo-alert">
        <span className="pp-fomo-dot" />
        EARLY ACCESS · FIRST 5,000 OPERATORS
      </div>

      <h2 className="pp-cta-headline">
        Get verified <span className="pp-accent-purple">before everyone else.</span>
      </h2>

      <p className="pp-cta-sub">
        A profile like this — <b className="pp-accent-purple">$0 forever</b> for the
        first 5,000 operators. After that, <b className="pp-accent-purple">$10/mo</b>.
        New operators pay from day one — with zero proofs, zero tier, zero visibility.
      </p>

      <div className="pp-fomo-price-card">
        <div className="pp-fpc-num">$0</div>
        <div className="pp-fpc-line">forever — first 5,000 only · then $10/mo</div>
        <div className="pp-fpc-fine">NO CREDIT CARD · NO EMAIL · JUST YOUR SOLANA WALLET</div>
      </div>

      <a
        className="pp-cta-btn pp-cta-orange-pulse"
        href={campaignSlug ? `/${campaignSlug}` : "/manage"}
        data-testid="pp-fomo-build"
      >
        &gt; BUILD YOUR PROFILE
      </a>

      <div className="pp-fomo-trust">
        <span className="pp-ft-b">✓ FOUNDING 5K BADGE</span>
        <span className="pp-ft-g">✓ KEEP YOUR HANDLE</span>
      </div>
    </section>
  );
}
