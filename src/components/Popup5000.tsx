"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

/**
 * First-5,000 popup — 3-phase counter logic:
 *
 * Phase 1 (theatrical): Time-based decay from 5,000 over ~30 days.
 *   Each day reduces by a seeded-random amount in the 150-170 range.
 *   All visitors see the same number on the same day.
 *
 * Phase 2 (low stock theatre): Once decay drops below 200,
 *   display cycles between 30-80 with small client-side ticks.
 *
 * Phase 3 (real check): At the 200 threshold, fetch /api/campaign/count.
 *   If real claims >= 4,900 (≤100 spots left), show 0 and disable CTA.
 *
 * Shows once per session on first homepage load after a 3s delay.
 */

// Campaign start date — anchor for deterministic daily decay
const CAMPAIGN_START = new Date("2026-04-10T00:00:00Z");
const TOTAL_SPOTS = 5000;
const DAILY_DECAY_MIN = 150;
const DAILY_DECAY_MAX = 170;
const LOW_STOCK_THRESHOLD = 200;
const REAL_CUTOFF = 100; // when real claims leave ≤100 spots, show 0

/** Seeded PRNG — deterministic per day so all visitors see the same number */
function seededRandom(day: number): number {
  let x = Math.sin(day * 9301 + 49297) * 49297;
  x = x - Math.floor(x);
  return x;
}

/** Calculate theatrical spots remaining based on days since campaign start */
function getTheatricalSpots(): number {
  const now = new Date();
  const msElapsed = now.getTime() - CAMPAIGN_START.getTime();
  const daysElapsed = Math.max(0, Math.floor(msElapsed / (1000 * 60 * 60 * 24)));

  let remaining = TOTAL_SPOTS;
  for (let d = 0; d < daysElapsed; d++) {
    const dailyDrop = DAILY_DECAY_MIN + Math.floor(seededRandom(d) * (DAILY_DECAY_MAX - DAILY_DECAY_MIN + 1));
    remaining -= dailyDrop;
    if (remaining <= LOW_STOCK_THRESHOLD) return LOW_STOCK_THRESHOLD;
  }

  // Partial day progress — interpolate within current day's drop
  const partialDay = (msElapsed / (1000 * 60 * 60 * 24)) - daysElapsed;
  const todayDrop = DAILY_DECAY_MIN + Math.floor(seededRandom(daysElapsed) * (DAILY_DECAY_MAX - DAILY_DECAY_MIN + 1));
  remaining -= Math.floor(todayDrop * partialDay);

  return Math.max(LOW_STOCK_THRESHOLD, remaining);
}

/** Low-stock phase: random number between 30-80 */
function getLowStockDisplay(): number {
  return 30 + Math.floor(Math.random() * 51);
}

export default function Popup5000() {
  const theatricalBase = getTheatricalSpots();
  const isLowStock = theatricalBase <= LOW_STOCK_THRESHOLD;

  const [spots, setSpots] = useState(isLowStock ? getLowStockDisplay() : theatricalBase);
  const [visible, setVisible] = useState(false);
  const [soldOut, setSoldOut] = useState(false);

  // Show once per session after 3s delay
  useEffect(() => {
    if (sessionStorage.getItem("popup5000_seen")) return;
    const show = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(show);
  }, []);

  // Check real Supabase count when in low-stock phase (edge-cached, 1 req/min)
  const checkReal = useCallback(async () => {
    try {
      const res = await fetch("/api/campaign/count");
      if (!res.ok) return;
      const data = await res.json();
      const realRemaining = TOTAL_SPOTS - (data.claimed ?? 0);
      if (realRemaining <= REAL_CUTOFF) {
        setSoldOut(true);
        setSpots(0);
      }
    } catch {
      // Silently fail — keep showing theatrical numbers
    }
  }, []);

  useEffect(() => {
    if (!visible || !isLowStock) return;
    checkReal();
  }, [visible, isLowStock, checkReal]);

  // Client-side tick animation
  useEffect(() => {
    if (!visible || soldOut) return;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      if (isLowStock) {
        // Low stock: shuffle between 30-80
        setSpots(getLowStockDisplay());
      } else {
        // Normal: tick down by 1
        setSpots((s) => Math.max(LOW_STOCK_THRESHOLD, s - 1));
      }
      const delay = isLowStock
        ? 3000 + Math.random() * 4000
        : 4000 + Math.random() * 5000;
      window.setTimeout(tick, delay);
    };

    const initial = window.setTimeout(tick, 3000);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
    };
  }, [visible, soldOut, isLowStock]);

  if (!visible) return null;

  const filledPct = ((TOTAL_SPOTS - spots) / TOTAL_SPOTS) * 100;

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem("popup5000_seen", "1");
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
              {soldOut ? "CLOSED" : "CLOSING"}
            </div>
          </div>

          <button type="button" className="close" onClick={dismiss} aria-label="Close">
            ×
          </button>

          <div className="body">
            <div className="pain">
              {soldOut
                ? "EARLY ACCESS — ALL SPOTS CLAIMED"
                : "EARLY ACCESS — PROFILES ARE LIVE NOW"}
            </div>
            <h2 className="head" id="p5k-head">
              {soldOut ? (
                <>
                  Free spots are
                  <br />
                  <span className="accent">gone.</span>
                </>
              ) : (
                <>
                  Get verified
                  <br />
                  <span className="accent">before everyone else.</span>
                </>
              )}
            </h2>

            <div className={`hero-number${soldOut ? " sold-out" : ""}`}>
              {spots.toLocaleString()}
            </div>
            <div className="hero-label">
              {soldOut ? (
                <>
                  <b>NO FREE SPOTS</b> REMAINING
                </>
              ) : (
                <>
                  <b>FREE SPOTS</b> LEFT OF 5,000
                </>
              )}
            </div>

            <div className="bar-track">
              <div
                className={`bar-fill${soldOut ? " bar-full" : ""}`}
                style={{ width: `${Math.min(filledPct, 100).toFixed(2)}%` }}
              />
            </div>

            {soldOut ? (
              <>
                <div className="price price-paid">
                  <span className="now-paid">$10</span>
                  <span className="was-note">per 30 days · standard upgrade</span>
                </div>
                <p className="loss">
                  The free window has closed. You can still build your profile and
                  upgrade to premium for <b>$10 / 30 days</b>.
                </p>
                <Link className="cta cta-disabled" href="/manage">
                  &gt; BUILD YOUR PROFILE · $10
                </Link>
              </>
            ) : (
              <>
                <div className="price">
                  <span className="now">$0</span>
                  <span className="was-note">
                    until 30 days after Grid launch · then $10/mo
                  </span>
                </div>
                <p className="loss">
                  Build your rank <b>before</b> the Grid opens. When coin devs
                  start hiring, you&rsquo;re already stacked.
                </p>
                <Link className="cta" href="/manage">
                  &gt; BUILD YOUR PROFILE
                </Link>
              </>
            )}

            <button type="button" className="no-thanks" onClick={dismiss}>
              {soldOut ? "Close" : "No, thanks"}
            </button>

            <div className="fine">
              no credit card — no email — just your solana wallet
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

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
  .hero-number.sold-out{color:#ff5470;text-shadow:0 0 22px rgba(255,84,112,.25)}
  .hero-label{font-family:var(--mono);font-size:11px;color:var(--text-primary);letter-spacing:2px;text-transform:uppercase;margin:8px 0 20px}
  .hero-label b{color:var(--accent)}
  .bar-track{width:100%;max-width:320px;height:5px;background:rgba(255,255,255,.04);border-radius:3px;overflow:hidden;margin:0 auto 22px;position:relative}
  .bar-fill{height:100%;background:linear-gradient(90deg,var(--accent) 0%,#ffb347 100%);border-radius:3px;box-shadow:0 0 10px rgba(255,145,0,.5)}
  .bar-fill.bar-full{background:linear-gradient(90deg,#ff5470 0%,#ff8a80 100%);box-shadow:0 0 10px rgba(255,84,112,.5)}
  .price{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;margin-bottom:22px;padding:16px 18px;background:var(--bg-card);border:1px solid rgba(0,230,118,.45);border-radius:var(--r-btn);box-shadow:0 0 30px rgba(0,230,118,.06)}
  .price.price-paid{border-color:var(--border-2);box-shadow:none}
  .price .now{font-family:var(--mono);font-size:30px;font-weight:800;color:var(--green);letter-spacing:-.5px;text-shadow:0 0 14px var(--green-glow);line-height:1}
  .price .now-paid{font-family:var(--mono);font-size:30px;font-weight:800;color:var(--text-primary);letter-spacing:-.5px;line-height:1}
  .price .was-note{font-family:var(--sans);font-size:12px;color:var(--text-secondary);margin-top:4px}
  .loss{font-family:var(--sans);font-size:13px;color:var(--text-secondary);line-height:1.55;margin:0 auto 16px;max-width:360px}
  .loss b{color:var(--text-primary)}
  .cta{display:block;width:100%;padding:15px 24px;color:var(--orange);background:var(--orange-dim);border:1px solid var(--orange);border-radius:var(--r-btn);font-family:var(--mono);font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all .15s;animation:pulseGlow 2.2s infinite;text-align:center;text-decoration:none}
  .cta:hover{background:var(--orange);color:#0a0b0f;box-shadow:0 0 24px var(--accent-glow);transform:translateY(-1px)}
  .cta.cta-disabled{color:var(--text-dim);background:var(--bg-card);border-color:var(--border-2);animation:none;cursor:default}
  .cta.cta-disabled:hover{background:var(--bg-card);color:var(--text-dim);box-shadow:none;transform:none}
  .no-thanks{display:inline-block;margin-top:12px;font-family:var(--mono);font-size:10px;color:var(--text-dim);letter-spacing:.5px;background:transparent;border:0;border-bottom:1px solid rgba(255,255,255,.08);padding:0 0 1px;cursor:pointer;transition:all .15s}
  .no-thanks:hover{color:var(--text-secondary)}
  .fine{margin-top:14px;font-family:var(--mono);font-size:10px;color:var(--text-dim);letter-spacing:1px}
`;
