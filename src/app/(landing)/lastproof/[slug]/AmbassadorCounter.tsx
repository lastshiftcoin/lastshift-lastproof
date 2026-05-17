/**
 * AmbassadorCounter — formerly a live depleting "X spots left" counter
 * with a progress bar animated via IntersectionObserver.
 *
 * 2026-05-16: counter mechanics REMOVED. Live depleting counts with
 * scarcity framing ("X spots left", "After 5,000, free access closes
 * permanently") are a top-weight signal in commercial phishing
 * classifiers (Google Safe Browsing, Netcraft, PhishTank). Ambassador
 * landing pages are publicly indexed — anonymous-visitor surface
 * area — so this is in scope for classifier exposure.
 *
 * Component shape preserved (still takes a `type: "badge" | "full"`
 * prop, still rendered from the same three landing pages) so the
 * six consumer call-sites in /lastproof/[slug], /earlyaccess, and
 * /[campaignSlug] do not need to be touched. Each variant now
 * renders a static, no-count, no-progress-bar replacement:
 *
 *   - badge: a small static topbar pill ("FIRST 5,000 · FREE FOREVER")
 *   - full: a centered single-line callout (no animated counter, no
 *     progress bar, no "X spots left" line)
 *
 * The component is now a server component — no state, no refs, no
 * useEffect, no IntersectionObserver. Removed:
 *   - import { useState, useEffect, useRef, useCallback }
 *   - computeTarget() time-based extrapolation
 *   - the animateCounter requestAnimationFrame loop
 *   - the IntersectionObserver mount logic
 *
 * If the EA cap is reached and we want to retire this surface
 * entirely, delete the import + JSX from each of the three landing
 * pages — at that point this stub can be removed in a follow-up.
 */

export function AmbassadorCounter({ type }: { type: "badge" | "full" }) {
  if (type === "badge") {
    return (
      <span className="af-topbar-badge">FIRST 5,000 · FREE FOREVER</span>
    );
  }

  return (
    <section className="af-section">
      <div className="af-counter-card">
        <div className="af-counter-label">Early Access</div>
        <div className="af-counter-of">
          Free profile <strong>forever</strong> for the first{" "}
          <strong>5,000</strong> operators.
        </div>
      </div>
    </section>
  );
}
