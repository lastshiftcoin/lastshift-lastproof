/**
 * FomoCtaStrip — footer CTA for the LEGEND / founding-5000 variant.
 *
 * Structural source: `wireframes/lastproof-profile-5000.html` lines ~786–814.
 * Purple border + green price card + orange urgency counter + pulsing CTA.
 *
 * TODO(terminal-attribution): the "> BUILD YOUR PROFILE" button needs to
 * hand off to the real Terminal at lastshift.app with attribution so the
 * founding-5K slot is credited correctly. Waiting on the terminal builder
 * to confirm the exact entry point + query param shape. For now the href
 * is a stub that the router can intercept once we know.
 */
export function FomoCtaStrip() {
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
        A profile like this — <b className="pp-accent-purple">$0</b> until 30 days after Grid launch,
        then <b className="pp-accent-purple">$10/mo</b>. Only the first 5,000 get the head start.
        After that, new operators pay from day one — with zero proofs, zero tier, zero visibility.
      </p>

      <div className="pp-fomo-price-card">
        <div className="pp-fpc-num">$0</div>
        <div className="pp-fpc-line">until 30 days after Grid launch — then $10/mo</div>
        <div className="pp-fpc-fine">NO CREDIT CARD · NO EMAIL · JUST YOUR SOLANA WALLET</div>
      </div>

      <div className="pp-fomo-counter">
        <div className="pp-fomo-counter-row">
          <span>OPERATORS CLAIMED</span>
          <span className="pp-fomo-counter-num">
            <span>4,277</span> / 5,000
          </span>
        </div>
        <div className="pp-fomo-bar">
          <div className="pp-fomo-bar-fill" style={{ width: "85.5%" }} />
        </div>
        <div className="pp-fomo-counter-foot">
          <b>723</b> SPOTS LEFT BEFORE EARLY ACCESS CLOSES
        </div>
      </div>

      <a
        className="pp-cta-btn pp-cta-orange-pulse"
        href="#terminal-attribution-tbd"
        data-testid="pp-fomo-build"
      >
        &gt; BUILD YOUR PROFILE
      </a>

      <div className="pp-fomo-trust">
        <span className="pp-ft-g">✓ 30-DAY HEAD START</span>
        <span className="pp-ft-b">✓ FOUNDING 5K BADGE</span>
        <span className="pp-ft-g">✓ KEEP YOUR HANDLE</span>
      </div>
    </section>
  );
}
