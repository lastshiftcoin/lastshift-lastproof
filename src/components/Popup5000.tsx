"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * First-5,000 popup. Mirrors wireframes/popup-5000.html.
 * Titlebar chrome is shared — all modals in LASTPROOF inherit this treatment.
 *
 * Decrementing counter is a theatrical device from the wireframe; kept as-is
 * for v1 (spec §12 "Wallet actions always user-initiated" is unrelated —
 * this only animates UI, no side effects).
 */
export default function Popup5000() {
  const router = useRouter();
  const [spots, setSpots] = useState(4277);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      setSpots((s) => (s > 4200 ? s - 1 : s));
      const delay = 4000 + Math.random() * 5000;
      window.setTimeout(tick, delay);
    };
    const initial = window.setTimeout(tick, 3000);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
    };
  }, []);

  if (!visible) return null;

  const filledPct = ((5000 - spots) / 5000) * 100;

  const dismiss = () => {
    setVisible(false);
    router.replace("/");
  };

  return (
    <>
      <style>{popupStyles}</style>
      <div className="scanlines" aria-hidden />
      <div className="stage" role="dialog" aria-modal="true" aria-labelledby="p5k-head">
        <div className="modal">
          <div className="titlebar">
            <div className="left">
              <div className="dots">
                <span className="r" />
                <span className="y" />
                <span className="g" />
              </div>
              <span className="title">lastproof — early access</span>
            </div>
            <div className="title-right">
              <span className="pulse" />
              CLOSING
            </div>
          </div>

          <button type="button" className="close" onClick={dismiss} aria-label="Close">
            ×
          </button>

          <div className="body">
            <div className="pain">EARLY ACCESS — PROFILES ARE LIVE NOW</div>
            <h2 className="head" id="p5k-head">
              Get verified
              <br />
              <span className="accent">before everyone else.</span>
            </h2>

            <div className="hero-number">{spots.toLocaleString()}</div>
            <div className="hero-label">
              <b>FREE SPOTS</b> LEFT OF 5,000
            </div>

            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${filledPct.toFixed(2)}%` }} />
            </div>

            <div className="price">
              <span className="now">$0</span>
              <span className="was-note">
                until 30 days after Grid launch · then $10/mo
              </span>
            </div>

            <p className="loss">
              Build your rank <b>before</b> the Grid opens. When coin devs start hiring,
              you&rsquo;re already stacked.
            </p>

            <Link className="cta" href="/manage">
              &gt; BUILD YOUR PROFILE
            </Link>
            <button type="button" className="no-thanks" onClick={dismiss}>
              No, thanks
            </button>

            <div className="fine">no credit card — no email — just your solana wallet</div>
          </div>
        </div>
      </div>
    </>
  );
}

/* Modal-local styles lifted from wireframes/popup-5000.html.
   Scoped by the classnames above so they don't bleed. */
const popupStyles = `
  .scanlines{position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.05) 2px,rgba(0,0,0,.05) 4px);pointer-events:none;z-index:9999}
  .stage{position:fixed;inset:0;z-index:9998;min-height:100dvh;padding:60px 20px;display:flex;align-items:center;justify-content:center}
  .stage::before{content:"";position:fixed;inset:0;background:rgba(5,6,10,.82);backdrop-filter:blur(4px);z-index:2}
  @keyframes popIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes pulseGlow{0%,100%{box-shadow:0 0 0 0 rgba(255,145,0,.35)}50%{box-shadow:0 0 0 10px rgba(255,145,0,0)}}
  @keyframes blink{0%,49%{opacity:1}50%,100%{opacity:.25}}
  .modal{position:relative;z-index:3;width:100%;max-width:440px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r-card);overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.02);animation:popIn .35s ease}
  .modal::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.06) 2px,rgba(0,0,0,.06) 4px);pointer-events:none;z-index:1;border-radius:inherit}
  .modal > *{position:relative;z-index:2}
  .titlebar{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(0,0,0,.3);border-bottom:1px solid var(--border)}
  .titlebar .left{display:flex;align-items:center;gap:8px}
  .dots{display:flex;gap:5px}
  .dots span{width:9px;height:9px;border-radius:50%}
  .dots .r{background:#ff5f56}.dots .y{background:#ffbd2e}.dots .g{background:#27c93f}
  .title{font-family:var(--mono);font-size:10px;color:var(--text-dim);letter-spacing:1px;margin-left:6px}
  .title-right{font-family:var(--mono);font-size:9px;color:var(--text-dim);letter-spacing:1.5px;display:flex;align-items:center;gap:6px}
  .pulse{width:6px;height:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 6px rgba(255,145,0,.6);animation:blink 1.2s infinite}
  .close{position:absolute;top:10px;right:12px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-family:var(--mono);font-size:14px;cursor:pointer;z-index:5;border-radius:var(--r-sm);transition:all .15s;background:transparent;border:0}
  .close:hover{color:var(--text-primary);background:rgba(255,255,255,.05)}
  .body{padding:28px 28px 24px;text-align:center}
  .pain{font-family:var(--mono);font-size:10px;color:var(--text-dim);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px}
  .pain::before{content:">";color:var(--orange);margin-right:6px;opacity:.6}
  h2.head{font-family:var(--sans);font-size:24px;font-weight:700;line-height:1.15;margin:0 0 22px;letter-spacing:-.3px;color:var(--text-primary)}
  h2.head .accent{color:var(--accent)}
  .hero-number{font-family:var(--mono);font-size:64px;font-weight:800;line-height:1;color:var(--accent);letter-spacing:-1px;text-shadow:0 0 22px rgba(255,145,0,.25);margin:0}
  .hero-label{font-family:var(--mono);font-size:11px;color:var(--text-primary);letter-spacing:2px;text-transform:uppercase;margin:8px 0 20px}
  .hero-label b{color:var(--accent)}
  .bar-track{width:100%;max-width:320px;height:5px;background:rgba(255,255,255,.04);border-radius:3px;overflow:hidden;margin:0 auto 22px;position:relative}
  .bar-fill{height:100%;background:linear-gradient(90deg,var(--accent) 0%,#ffb347 100%);border-radius:3px;box-shadow:0 0 10px rgba(255,145,0,.5)}
  .price{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;margin-bottom:22px;padding:16px 18px;background:var(--bg-card);border:1px solid rgba(0,230,118,.45);border-radius:var(--r-btn);box-shadow:0 0 30px rgba(0,230,118,.06)}
  .price .now{font-family:var(--mono);font-size:30px;font-weight:800;color:var(--green);letter-spacing:-.5px;text-shadow:0 0 14px var(--green-glow);line-height:1}
  .price .was-note{font-family:var(--sans);font-size:12px;color:var(--text-secondary);margin-top:4px}
  .loss{font-family:var(--sans);font-size:13px;color:var(--text-secondary);line-height:1.55;margin:0 auto 16px;max-width:360px}
  .loss b{color:var(--text-primary)}
  .cta{display:block;width:100%;padding:15px 24px;color:var(--orange);background:var(--orange-dim);border:1px solid var(--orange);border-radius:var(--r-btn);font-family:var(--mono);font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all .15s;animation:pulseGlow 2.2s infinite;text-align:center;text-decoration:none}
  .cta:hover{background:var(--orange);color:#0a0b0f;box-shadow:0 0 24px var(--accent-glow);transform:translateY(-1px)}
  .no-thanks{display:inline-block;margin-top:12px;font-family:var(--mono);font-size:10px;color:var(--text-dim);letter-spacing:.5px;background:transparent;border:0;border-bottom:1px solid rgba(255,255,255,.08);padding:0 0 1px;cursor:pointer;transition:all .15s}
  .no-thanks:hover{color:var(--text-secondary)}
  .fine{margin-top:14px;font-family:var(--mono);font-size:10px;color:var(--text-dim);letter-spacing:1px}
`;
