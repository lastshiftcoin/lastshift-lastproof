import Link from "next/link";

interface CtaStripProps {
  /** "free" adds the green-dashed border variant from the free wireframe. */
  variant?: "default" | "free";
  /** If the profile owner is an ambassador, link to their campaign page. */
  campaignSlug?: string | null;
}

export function CtaStrip({ variant = "default", campaignSlug }: CtaStripProps = {}) {
  const buildHref = campaignSlug ? `/${campaignSlug}` : "/manage";

  return (
    <section className={`pp-cta-strip${variant === "free" ? " pp-cta-strip-free" : ""}`}>
      <div className="pp-cta-eyebrow">
        {variant === "free"
          ? "FREE FOREVER · FIRST 5,000 OPERATORS · THEN $10/MO"
          : "LASTPROOF · THE OPERATOR GRID"}
      </div>
      <h2 className="pp-cta-headline">
        Hire <span className="pp-accent">proven operators.</span> Or become one.
      </h2>
      <p className="pp-cta-sub">
        Devs &amp; teams: stop guessing — every operator on the Grid has on-chain proofs from real projects.
        Operators: get discovered by the people actually paying.
      </p>
      <div className="pp-cta-dual">
        <button type="button" className="pp-cta-btn pp-cta-green">
          &gt; HIRE AN OPERATOR
        </button>
        <Link href={buildHref} className="pp-cta-btn">
          &gt; BUILD YOUR PROFILE
        </Link>
      </div>
      <div className="pp-cta-fine">START YOUR PROFILE IN 60 SECS OR LESS</div>
    </section>
  );
}
