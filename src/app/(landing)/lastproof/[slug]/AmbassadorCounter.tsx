"use client";

import { useState, useEffect, useRef, useCallback } from "react";

function computeTarget(): number {
  const launchDate = new Date("2026-04-05");
  const now = new Date();
  const weeksSinceLaunch = Math.max(
    0,
    Math.floor((now.getTime() - launchDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
  );
  const baseCount = 437 + weeksSinceLaunch * 82;
  const jitter = Math.floor(Math.random() * 61) - 30;
  return Math.min(4800, Math.max(400, baseCount + jitter));
}

export function AmbassadorCounter({ type }: { type: "badge" | "full" }) {
  const [count, setCount] = useState(0);
  const [target] = useState(computeTarget);
  const remaining = 5000 - target;
  const animatedRef = useRef(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  const animateCounter = useCallback(() => {
    if (animatedRef.current) return;
    animatedRef.current = true;
    const duration = 1500;
    const start = performance.now();
    function tick(ts: number) {
      const elapsed = ts - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [target]);

  useEffect(() => {
    if (type === "badge") {
      setCount(target);
      return;
    }
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) animateCounter(); },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [type, target, animateCounter]);

  if (type === "badge") {
    return (
      <span className="af-topbar-badge">{remaining.toLocaleString()} spots left</span>
    );
  }

  const barWidth = (count / 5000) * 100;

  return (
    <section className="af-section" ref={sectionRef}>
      <div className="af-counter-card">
        <div className="af-counter-label">Operators Building Proofs</div>
        <div className="af-counter-number">{count.toLocaleString()}</div>
        <div className="af-counter-of">of <strong>5,000</strong> free spots</div>
        <div className="af-counter-bar-track">
          <div className="af-counter-bar-fill" style={{ width: `${barWidth}%` }} />
        </div>
      </div>
      <p className="af-section-body" style={{ textAlign: "center", marginTop: 16 }}>
        <strong>{remaining.toLocaleString()} spots left.</strong> After 5,000, free access closes permanently.
      </p>
    </section>
  );
}
