"use client";

/**
 * ManageTerminal — the wireframed boot sequence + wallet connect + Terminal ID gate.
 *
 * State machine:
 *   boot → connect → connecting → validating →
 *     granted (dashboard-entry wireframe) | no-terminal | error
 *
 * Uses the real Solana wallet adapter (already provided by WalletBoundary in
 * the marketing layout). On successful Terminal ID validation, writes session
 * cookie via /api/auth/validate-tid and shows the MANAGE PROFILE CTA.
 *
 * If the user already has a valid session cookie (passed via initialSession),
 * skips the boot sequence entirely and shows the granted state.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { Session } from "@/lib/session";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | "boot"
  | "connect"
  | "connecting"
  | "connected"
  | "validating"
  | "granted"
  | "no-terminal"
  | "error";

interface ManageTerminalProps {
  initialSession: Session | null;
}

// ─── Boot lines ───────────────────────────────────────────────────────────────

const BOOT_LINES: { text: string; cls: string; delay: number }[] = [
  { text: "LASTPROOF v1.0 // MANAGE PROFILE", cls: "", delay: 600 },
  { text: "Booting profile subsystem...", cls: "", delay: 1100 },
  { text: "Grid node online [NODE-07]", cls: "", delay: 1700 },
  { text: "SHIFTBOT linked", cls: "", delay: 2300 },
  { text: "Awaiting wallet handshake...", cls: "accent", delay: 2900 },
  { text: "Connect Solana wallet to authenticate", cls: "accent", delay: 3500 },
];

const DIVIDER_DELAY = 4100;
const CONNECT_DELAY = 4400;

// ─── Component ────────────────────────────────────────────────────────────────

export default function ManageTerminal({ initialSession }: ManageTerminalProps) {
  const { select, wallets, publicKey, connected, connecting, disconnect } = useWallet();

  const [phase, setPhase] = useState<Phase>(initialSession ? "granted" : "boot");
  const [session, setSession] = useState<Session | null>(initialSession);
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [dividerVisible, setDividerVisible] = useState(false);
  const [connectVisible, setConnectVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [clock, setClock] = useState("");
  const [postLines, setPostLines] = useState<{ text: string; cls: string }[]>([]);

  const validatingRef = useRef(false);

  // ─── Isolation: disconnect wallet when leaving /manage ──────────────────────
  // Prevents the operator's connected wallet from bleeding into the proof modal
  // on profile pages. The WalletBoundary is shared across the (marketing) layout,
  // so without this cleanup a wallet connection would persist across routes.
  useEffect(() => {
    return () => {
      if (connected) {
        disconnect().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Live clock ─────────────────────────────────────────────────────────────
  useEffect(() => {
    function tick() {
      const now = new Date();
      setClock(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    }
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  // ─── Boot sequence ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "boot") return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    BOOT_LINES.forEach((line, i) => {
      timers.push(
        setTimeout(() => setVisibleLines((v) => Math.max(v, i + 1)), line.delay),
      );
    });

    timers.push(setTimeout(() => setDividerVisible(true), DIVIDER_DELAY));
    timers.push(
      setTimeout(() => {
        setConnectVisible(true);
        setPhase("connect");
      }, CONNECT_DELAY),
    );

    return () => timers.forEach(clearTimeout);
  }, [phase]);

  // ─── Watch wallet connection state ──────────────────────────────────────────
  useEffect(() => {
    if (connecting && phase === "connect") {
      setPhase("connecting");
    }
  }, [connecting, phase]);

  useEffect(() => {
    if (connected && publicKey && (phase === "connecting" || phase === "connect")) {
      setPhase("connected");
    }
  }, [connected, publicKey, phase]);

  // ─── Validate Terminal ID once wallet connects ──────────────────────────────
  useEffect(() => {
    if (phase !== "connected" || !publicKey || validatingRef.current) return;
    validatingRef.current = true;
    validateTerminal(publicKey.toBase58());
  }, [phase, publicKey]);

  const validateTerminal = useCallback(async (walletAddress: string) => {
    setPhase("validating");

    // Show post-connect lines
    const lines: { text: string; cls: string }[] = [];

    const addLine = (text: string, cls: string) => {
      lines.push({ text, cls });
      setPostLines([...lines]);
    };

    await delay(400);
    addLine(`Wallet connected -- ${shorten(walletAddress)}`, "green");
    await delay(600);
    addLine("Verifying terminal ID...", "accent");

    try {
      // First, check if we have a session already (page reload case)
      const sessionRes = await fetch("/api/auth/session");
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        if (sessionData.ok && sessionData.session) {
          addLine(`Terminal ID verified [${sessionData.session.terminalId.slice(-4)}]`, "green");
          await delay(400);
          addLine("Session granted", "green");
          await delay(300);
          addLine("Entering LASTPROOF...", "accent");
          setSession(sessionData.session);
          setPhase("granted");
          return;
        }
      }

      // No existing session — look up wallet → operator → Terminal ID.
      // The wallet-gate endpoint queries Supabase for the operator's TID,
      // then validates it via the Terminal API in one round-trip.
      const lookupRes = await fetch("/api/auth/wallet-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });

      const body = await lookupRes.json();

      if (lookupRes.ok && body.ok) {
        addLine(`Terminal ID verified [${body.session.terminalId.slice(-4)}]`, "green");
        await delay(400);
        addLine("Session granted", "green");
        await delay(300);
        addLine("Entering LASTPROOF...", "accent");
        setSession(body.session);
        setPhase("granted");
      } else if (body.reason === "no_terminal" || body.reason === "wallet_not_registered" || body.reason === "tid_not_found") {
        addLine("No terminal ID bound to wallet", "red");
        await delay(400);
        addLine("Authentication failed [ERR 404]", "red");
        await delay(300);
        addLine("Operator credentials required", "accent");
        setPhase("no-terminal");
      } else {
        addLine(`Validation failed: ${body.reason || "unknown"}`, "red");
        setErrorMsg(body.message || "Terminal validation failed");
        setPhase("error");
      }
    } catch (err) {
      addLine("Network error -- could not reach server", "red");
      setErrorMsg(err instanceof Error ? err.message : "Network error");
      setPhase("error");
    }
  }, []);

  // ─── Connect handler ───────────────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    if (phase !== "connect") return;

    // select() sets the active adapter, then connect() triggers the wallet popup.
    // autoConnect is false in WalletBoundary, so we must call connect() explicitly.
    if (wallets.length > 0) {
      try {
        select(wallets[0].adapter.name);
        // Give the adapter a tick to register the selection before connecting
        await new Promise((r) => setTimeout(r, 100));
        await wallets[0].adapter.connect();
      } catch (err) {
        console.error("[ManageTerminal] wallet connect failed:", err);
        setPhase("connect"); // reset to allow retry
      }
    }
  }, [phase, wallets, select]);

  // ─── Sign out ──────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    await disconnect();
    setSession(null);
    setPhase("boot");
    setVisibleLines(0);
    setDividerVisible(false);
    setConnectVisible(false);
    setPostLines([]);
    setErrorMsg("");
    validatingRef.current = false;
  }, [disconnect]);

  // ─── Derive titlebar / sys-bar labels ───────────────────────────────────────
  const sysTag = phase === "no-terminal"
    ? "LASTPROOF // NO TERMINAL ID"
    : phase === "granted"
      ? "LASTPROOF // DASHBOARD ENTRY"
      : "LASTPROOF // MANAGE PROFILE";

  const titlebarTitle = "boot -- lastproof -- 80x24";
  const titlebarRight = phase === "granted" ? "PID 1" : "PID 1";

  const bottomLabel = phase === "no-terminal"
    ? "MANAGE PROFILE // NO TERMINAL ID"
    : phase === "granted"
      ? "MANAGE PROFILE // DASHBOARD ENTRY"
      : "MANAGE PROFILE // SCREEN 1";

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mg-page">
      <div className="mg-crt-overlay" />
      <div className="mg-vignette" />

      {/* System bar */}
      <div className="mg-sys-bar">
        <div className="mg-sys-bar-left">
          <img src="/shiftbot-logo.png" alt="" className="mg-sys-logo" />
          <span className="mg-sys-tag">{sysTag}</span>
          <span className="mg-sys-dot" />
        </div>
        <span className="mg-sys-time">{clock}</span>
      </div>

      {/* Terminal frame */}
      <div className="mg-terminal">
        <div className="mg-titlebar">
          <div className="mg-titlebar-dots">
            <div className="mg-dot mg-dot-red" />
            <div className="mg-dot mg-dot-yellow" />
            <div className="mg-dot mg-dot-green" />
          </div>
          <span className="mg-titlebar-title">{titlebarTitle}</span>
          <span className="mg-titlebar-right">{titlebarRight}</span>
        </div>

        <div className="mg-body">
          {/* ─── Boot lines ─────────────────────────────────── */}
          {(phase === "boot" || phase === "connect" || phase === "connecting" ||
            phase === "connected" || phase === "validating") && (
            <>
              <img src="/shiftbot-logo.png" alt="SHIFTBOT" className="mg-boot-logo" />
              {BOOT_LINES.map((line, i) => (
                <div
                  key={i}
                  className={`mg-boot-line ${line.cls} ${i < visibleLines ? "visible" : ""}`}
                >
                  {line.text}
                  {i === BOOT_LINES.length - 1 && i < visibleLines && phase === "boot" && (
                    <span className="mg-cursor" />
                  )}
                </div>
              ))}

              <div className={`mg-divider ${dividerVisible ? "visible" : ""}`} />

              {/* Connect section */}
              <div className={`mg-connect ${connectVisible ? "visible" : ""}`}>
                <div className="mg-connect-prompt">Connect Solana Wallet</div>
                <button
                  className={`mg-connect-btn ${
                    phase === "connecting" ? "connecting" :
                    phase === "connected" || phase === "validating" ? "connected" :
                    ""
                  }`}
                  onClick={handleConnect}
                  disabled={phase !== "connect"}
                >
                  {phase === "connecting"
                    ? "CONNECTING..."
                    : phase === "connected" || phase === "validating"
                      ? "WALLET CONNECTED"
                      : "CONNECT WALLET"}
                </button>
                <div className="mg-connect-sub">
                  {phase === "connected" || phase === "validating"
                    ? "Initializing..."
                    : "Phantom, Jupiter, Binance + more"}
                </div>
                <Link href="/manage/safety" className="mg-safe-link">
                  Is it safe to connect my wallet?
                </Link>
              </div>

              {/* Post-connect validation lines */}
              {postLines.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  {postLines.map((line, i) => (
                    <div key={i} className={`mg-post-line visible ${line.cls}`}>
                      {line.text}
                      {i === postLines.length - 1 && phase === "validating" && (
                        <span className="mg-cursor" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ─── Granted state (dashboard-entry) ────────────── */}
          {phase === "granted" && (
            <>
              {postLines.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  {postLines.map((line, i) => (
                    <div key={i} className={`mg-post-line visible ${line.cls}`}>
                      {line.text}
                    </div>
                  ))}
                </div>
              )}

              <div className="mg-divider visible" />

              <div className="mg-reveal visible">
                <div className="mg-reveal-label">{">>"} LASTPROOF v1.0</div>
                <div className="mg-reveal-text">
                  ACCESS GRANTED // <span className="accent">LASTPROOF</span>
                </div>
                <Link href="/manage/profile" className="mg-cta-btn">
                  MANAGE PROFILE
                </Link>
                {session && (
                  <div className="mg-connect-sub" style={{ marginTop: 4 }}>
                    {session.terminalId} · {shorten(session.walletAddress)}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="mg-safe-link"
                  style={{ background: "none", border: "none", cursor: "pointer" }}
                >
                  Sign out
                </button>
              </div>
            </>
          )}

          {/* ─── No Terminal ID state ───────────────────────── */}
          {phase === "no-terminal" && (
            <>
              {postLines.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  {postLines.map((line, i) => (
                    <div key={i} className={`mg-post-line visible ${line.cls}`}>
                      {line.text}
                    </div>
                  ))}
                </div>
              )}

              <div className="mg-divider visible" />

              <div className="mg-reveal visible">
                <div className="mg-reveal-label">{">>"} LASTPROOF v1.0 REQUIREMENT</div>
                <div className="mg-reveal-text">
                  CREATE TERMINAL ID // <span className="accent">LASTSHIFT TERMINAL</span>
                </div>
                <a
                  href="https://lastshift.app/connect"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mg-cta-btn external"
                >
                  LAUNCH TERMINAL
                </a>
              </div>
            </>
          )}

          {/* ─── Error state ────────────────────────────────── */}
          {phase === "error" && (
            <>
              {postLines.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  {postLines.map((line, i) => (
                    <div key={i} className={`mg-post-line visible ${line.cls}`}>
                      {line.text}
                    </div>
                  ))}
                </div>
              )}

              <div className="mg-divider visible" />

              <div className="mg-reveal visible">
                <div className="mg-reveal-label" style={{ color: "var(--red)" }}>
                  {">>"} CONNECTION ERROR
                </div>
                <div className="mg-reveal-text" style={{ fontSize: 13 }}>
                  {errorMsg}
                </div>
                <button
                  type="button"
                  className="mg-cta-btn external"
                  onClick={handleSignOut}
                >
                  TRY AGAIN
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mg-bottom-bar">
        <a href="https://lastshift.ai" target="_blank" rel="noopener noreferrer">
          lastshift.ai
        </a>
        <span>{bottomLabel}</span>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shorten(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
