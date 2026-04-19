"use client";

/**
 * ManageTerminal — the wireframed boot sequence + wallet connect + Terminal ID gate.
 *
 * State machine:
 *   boot → connect → connecting → validating →
 *     granted | enter-tid (new wallet) | tid-reset (TID regenerated) | no-terminal | error
 *
 * Three wallet-connect outcomes:
 *   1. Wallet recognized + TID valid → granted (dashboard)
 *   2. Wallet recognized + TID stale (regenerated) → tid-reset (TID input to re-auth)
 *   3. Wallet not recognized → enter-tid (TID input for new user)
 *   4. No TID entered / failed → no-terminal (link to Terminal)
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
  | "enter-tid"
  | "tid-reset"
  | "registering"
  | "no-terminal"
  | "error";

interface ManageTerminalProps {
  initialSession: Session | null;
  /** Ambassador campaign slug from ?ref= URL param. Carried through onboarding. */
  ref_slug?: string | null;
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

export default function ManageTerminal({ initialSession, ref_slug }: ManageTerminalProps) {
  const { select, wallets, publicKey, connected, connecting, disconnect } = useWallet();

  const [phase, setPhase] = useState<Phase>(initialSession ? "granted" : "boot");
  const [session, setSession] = useState<Session | null>(initialSession);
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [dividerVisible, setDividerVisible] = useState(false);
  const [connectVisible, setConnectVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [clock, setClock] = useState("");
  const [postLines, setPostLines] = useState<{ text: string; cls: string }[]>([]);
  const [tidInput, setTidInput] = useState("");
  const [tidError, setTidError] = useState("");
  const [walletAddr, setWalletAddr] = useState("");

  // Stash the ref slug in localStorage on every fresh URL visit so it
  // survives the mobile-wallet-return roundtrip. Phantom/Solflare opening
  // the wallet app and returning to the dapp often strips the query string
  // on return — that's how @coreops lost attribution on 2026-04-18.
  //
  // localStorage is NOT a cookie: never auto-sent to the server, client
  // controlled, origin-scoped. Acts only as a memory cell across the
  // wallet deep-link hop. Read back inline before each auth POST.
  useEffect(() => {
    if (!ref_slug) return;
    try {
      window.localStorage.setItem("lp_ref_slug", ref_slug);
    } catch {
      // Private mode / storage disabled — degrade silently.
    }
  }, [ref_slug]);

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
      lines.push({ text: `> ${text}`, cls });
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
      //
      // Attribution: forward ref_slug so first-touch ambassador referral
      // gets stamped on the operators row here, not later at claim time
      // where ?ref= may have been lost. URL is still /manage?ref=<slug>
      // at this exact moment — no navigation has happened.
      // Pull freshest effective ref: prefer the prop, fall back to localStorage.
      // Read directly here (not via closure) so the mobile-wallet-return case
      // where the page re-rendered with ref_slug=null still captures the
      // localStorage-stashed value.
      let refForPost: string | null = ref_slug ?? null;
      if (!refForPost) {
        try { refForPost = window.localStorage.getItem("lp_ref_slug"); } catch { /* noop */ }
      }
      const lookupRes = await fetch("/api/auth/wallet-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, ref: refForPost ?? undefined }),
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
      } else if (body.reason === "tid_reset") {
        // Returning user whose TID was regenerated on Terminal
        addLine("Terminal ID expired [TID REGENERATED]", "red");
        await delay(400);
        addLine("Your Terminal ID has been reset", "");
        await delay(300);
        addLine("Re-authentication required", "accent");
        setWalletAddr(walletAddress);
        setPhase("tid-reset");
      } else if (body.reason === "no_terminal" || body.reason === "wallet_not_registered") {
        // New wallet — not in operators table
        addLine("New wallet detected [NO REGISTRY MATCH]", "accent");
        await delay(400);
        addLine("Operator not found in local registry", "");
        await delay(300);
        addLine("Authentication process booting...", "accent");
        await delay(300);
        addLine("Terminal ID required for access", "");
        setWalletAddr(walletAddress);
        setPhase("enter-tid");
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

  // ─── Register TID (new wallet or TID reset) ────────────────────────────────
  const handleRegisterTid = useCallback(async () => {
    const tid = tidInput.trim().toUpperCase();
    // Accept both XXXX-XXXX-XXXX-XXXX-XXXX and XXXX-XXXX-XXXX-XXXX-XXXX
    if (!/^[A-Z0-9]{4}(-[A-Z0-9]{4}){4}$/.test(tid) &&
        !/^SHIFT-[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(tid)) {
      setTidError("Format: XXXX-XXXX-XXXX-XXXX-XXXX");
      return;
    }
    setTidError("");
    const prevPhase = phase as Phase;
    setPhase("registering");

    const lines: { text: string; cls: string }[] = [...postLines];
    const addLine = (text: string, cls: string) => {
      lines.push({ text: `> ${text}`, cls });
      setPostLines([...lines]);
    };

    addLine("Authenticating terminal ID...", "accent");

    try {
      // Pull freshest effective ref: prop → localStorage fallback (see validateTerminal)
      let refForPost: string | null = ref_slug ?? null;
      if (!refForPost) {
        try { refForPost = window.localStorage.getItem("lp_ref_slug"); } catch { /* noop */ }
      }
      const res = await fetch("/api/auth/register-tid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Forward ref for first-touch ambassador attribution on operator insert.
        body: JSON.stringify({ walletAddress: walletAddr, terminalId: tid, ref: refForPost ?? undefined }),
      });
      const body = await res.json();

      if (res.ok && body.ok) {
        addLine(`Terminal ID verified [${tid.slice(-4)}]`, "green");
        await delay(300);
        if (body.isNew) {
          addLine("Operator registered [NEW ENTRY]", "green");
        } else {
          addLine("Operator record updated [TID REPLACED]", "green");
        }
        await delay(300);
        addLine("Session granted", "green");
        await delay(300);
        addLine(body.isNew ? "Launching onboarding..." : "Entering LASTPROOF...", "accent");
        setSession(body.session);
        setPhase("granted");
      } else {
        addLine(`Authentication failed [${(body.reason || "UNKNOWN").toUpperCase()}]`, "red");
        await delay(300);
        addLine(body.message || "Terminal ID does not match this wallet", "red");
        setTidError(body.message || "Authentication failed");
        setPhase(prevPhase === "tid-reset" ? "tid-reset" : "enter-tid");
      }
    } catch (err) {
      addLine("Network error -- could not reach server", "red");
      setTidError("Network error. Try again.");
      setPhase(prevPhase === "tid-reset" ? "tid-reset" : "enter-tid");
    }
  }, [tidInput, walletAddr, phase, postLines]);

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
    setTidInput("");
    setTidError("");
    setWalletAddr("");
    validatingRef.current = false;
  }, [disconnect]);

  // ─── Derive titlebar / sys-bar labels ───────────────────────────────────────
  const sysTag = phase === "no-terminal"
    ? "LASTPROOF // NO TERMINAL ID"
    : phase === "enter-tid" || phase === "registering"
      ? "LASTPROOF // AUTHENTICATE"
      : phase === "tid-reset"
        ? "LASTPROOF // TID CHANGED"
        : phase === "granted"
          ? "LASTPROOF // DASHBOARD ENTRY"
          : "LASTPROOF // MANAGE PROFILE";

  const titlebarTitle = "boot -- lastproof -- 80x24";
  const titlebarRight = phase === "granted" ? "PID 1" : "PID 1";

  const bottomLabel = phase === "no-terminal"
    ? "MANAGE PROFILE // NO TERMINAL ID"
    : phase === "enter-tid" || phase === "registering"
      ? "MANAGE PROFILE // AUTHENTICATE"
      : phase === "tid-reset"
        ? "MANAGE PROFILE // TID CHANGED"
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
                <div style={{ marginTop: 16, textAlign: "center" }}>
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
                <div style={{ marginBottom: 16, textAlign: "center" }}>
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
                <Link href={ref_slug ? `/manage/profile?ref=${ref_slug}` : "/manage/profile"} className="mg-cta-btn">
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

          {/* ─── Enter TID state (new wallet) ─────────────────── */}
          {(phase === "enter-tid" || phase === "tid-reset" || phase === "registering") && (
            <>
              {postLines.length > 0 && (
                <div style={{ marginBottom: 16, textAlign: "center" }}>
                  {postLines.map((line, i) => (
                    <div key={i} className={`mg-post-line visible ${line.cls}`}>
                      {line.text}
                    </div>
                  ))}
                </div>
              )}

              <div className="mg-divider visible" />

              <div className="mg-reveal visible">
                <div className="mg-reveal-label">
                  {">>"} {phase === "tid-reset" ? "TERMINAL ID CHANGED" : "TERMINAL ID AUTHENTICATION"}
                </div>
                <div className="mg-reveal-text">
                  {phase === "tid-reset" ? (
                    <>YOUR TERMINAL ID WAS <span className="accent">RESET</span></>
                  ) : (
                    <>ENTER YOUR <span className="accent">TERMINAL ID</span></>
                  )}
                </div>
                {phase === "tid-reset" && (
                  <div className="mg-tid-hint">
                    Your previous Terminal ID is no longer valid.<br />
                    Enter your new Terminal ID to continue.
                  </div>
                )}
                <div className="mg-tid-input-wrap">
                  <label className="mg-tid-label" htmlFor="tid-input">
                    {phase === "tid-reset" ? "New Terminal ID" : "Terminal ID"}
                  </label>
                  <input
                    id="tid-input"
                    type="text"
                    className={`mg-tid-input${tidError ? " error" : ""}`}
                    placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
                    value={tidInput}
                    onChange={(e) => { setTidInput(e.target.value.toUpperCase()); setTidError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleRegisterTid(); }}
                    disabled={phase === "registering"}
                    autoFocus
                  />
                  {tidError && <div className="mg-tid-error">{tidError}</div>}
                </div>
                <button
                  type="button"
                  className="mg-cta-btn"
                  onClick={handleRegisterTid}
                  disabled={phase === "registering"}
                >
                  {phase === "registering"
                    ? "AUTHENTICATING..."
                    : phase === "tid-reset"
                      ? "RE-AUTHENTICATE"
                      : "AUTHENTICATE"}
                </button>
                <div className="mg-connect-sub" style={{ marginTop: 14, color: "#fff", textShadow: "0 0 8px rgba(255,255,255,0.4)" }}>
                  Don&apos;t have a Terminal ID?
                </div>
                <a
                  href="https://lastshift.app/connect"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mg-safe-link"
                  style={{ marginTop: 6, color: "#fff", textShadow: "0 0 8px rgba(255,255,255,0.4)" }}
                >
                  LAUNCH TERMINAL
                </a>
              </div>
            </>
          )}

          {/* ─── No Terminal ID state ───────────────────────── */}
          {phase === "no-terminal" && (
            <>
              {postLines.length > 0 && (
                <div style={{ marginBottom: 16, textAlign: "center" }}>
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
                <div style={{ marginBottom: 16, textAlign: "center" }}>
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
