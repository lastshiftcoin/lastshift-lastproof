/**
 * Fixed-bottom SHIFTBOT command strip. Appears on every page per the wireframes.
 * Interactive expand is deferred — this is the collapsed presentation state.
 */
export default function ShiftbotStrip() {
  return (
    <div className="shiftbot">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/shiftbot-logo.png" alt="SHIFTBOT" className="sb-mini-logo" />
      <div className="label">SHIFTBOT</div>
      <div className="cursor">&gt;</div>
      <div className="ph">
        ask anything — &ldquo;help me find a raider&rdquo;, &ldquo;who&rsquo;s the best X Spaces host?&rdquo;
      </div>
      <button type="button" className="expand">[ EXPAND ↑ ]</button>
    </div>
  );
}
