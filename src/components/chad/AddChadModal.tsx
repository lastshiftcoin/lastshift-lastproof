"use client";

/**
 * AddChadModal — the entire Add Chad experience, in-modal from start to
 * finish. Opens from the static `+ ADD CHAD` button on every public
 * profile. The user never leaves the profile page.
 *
 * 10 wireframe phases (matches `wireframes/lastproof-add-chad-modal.html`):
 *
 *   connect    — no wallet attached. Render single CONNECT WALLET button
 *                (UX mirrors /manage's open screen — wallet-adapter
 *                handles which wallet the user picks via the wallet's
 *                own popup; we don't render a tile picker).
 *   checking   — wallet connecting OR wallet-gate in flight OR
 *                eligibility resolving. One spinner screen for the whole
 *                resolve sequence (wireframe collapses connecting +
 *                checking into one phase).
 *   eligible   — paid+published viewer, no relationship → submit CTA
 *   submitting — /api/chads/request in flight
 *   success    — request recorded → "DISCONNECT & BACK TO PROFILE"
 *   already    — chads exist; view-state, no Remove (Remove lives in dashboard)
 *   pending    — request already in flight (either direction); no resend
 *   free       — viewer's profile is free → purple upgrade nudge → /manage
 *   no-profile — viewer's wallet has no profile → /manage CTA
 *                (also covers wallet-gate's no_terminal / wallet_not_registered
 *                / tid_reset responses — all map to "you don't have a usable
 *                profile yet, go onboard via /manage")
 *   own        — viewer is the target → soft dead-end
 *
 * Auth model: after the user connects their wallet in-modal, we call
 * /api/auth/wallet-gate (the same endpoint /manage uses) to create a
 * session cookie. Once the session exists, /api/chads/eligibility and
 * subsequent chad endpoints work as normal. No redirect. Profile page
 * is wrapped in WalletProvider via (marketing)/layout.tsx so useWallet()
 * is available here.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { ChadPhase } from "@/lib/chads/resolve-phase";

interface ResolutionTarget {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  tier: number;
  armyCount: number;
}

interface ResolutionViewer {
  wallet: string;
  handle: string | null;
  displayName: string | null;
}

interface PhaseResolution {
  phase: ChadPhase;
  viewer: ResolutionViewer;
  target: ResolutionTarget;
  relationshipSince: string | null;
}

type ClientState =
  | { kind: "connect" }
  | { kind: "checking"; line: string }
  | { kind: "resolved"; resolution: PhaseResolution }
  | { kind: "submitting"; resolution: PhaseResolution }
  | { kind: "success"; resolution: PhaseResolution }
  | { kind: "no-profile-from-gate" } // wallet-gate failure that should land on no-profile UI
  | { kind: "error"; reason: string };

interface Props {
  targetHandle: string;
  /** Pre-known target preview, shown on the connect screen before
   *  eligibility resolves (the public profile page knows this already). */
  targetDisplayName: string;
  targetAvatarUrl: string | null;
  onClose: () => void;
}

export function AddChadModal({
  targetHandle,
  targetDisplayName,
  targetAvatarUrl,
  onClose,
}: Props) {
  const { select, wallets, publicKey, connected, connecting, disconnect } = useWallet();
  const [state, setState] = useState<ClientState>({ kind: "connect" });
  const resolveOnce = useRef(false);

  // ESC closes.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // If a wallet is already connected when the modal opens, skip the
  // connect screen and go straight into the resolve sequence.
  useEffect(() => {
    if (state.kind !== "connect") return;
    if (connected && publicKey) {
      setState({ kind: "checking", line: "Scanning operator registry…" });
    }
  }, [state.kind, connected, publicKey]);

  // While wallet adapter is in the "connecting" state, show checking screen.
  useEffect(() => {
    if (connecting && state.kind === "connect") {
      setState({ kind: "checking", line: "Awaiting wallet confirmation…" });
    }
  }, [connecting, state.kind]);

  // After connecting completes, advance the spinner into the resolve sequence.
  useEffect(() => {
    if (state.kind === "checking" && state.line === "Awaiting wallet confirmation…" && connected && publicKey) {
      setState({ kind: "checking", line: "Scanning operator registry…" });
    }
  }, [state, connected, publicKey]);

  // Run the resolve sequence: wallet-gate → eligibility. Triggered the
  // first time we land on "checking" with a "Scanning…" line and a
  // connected wallet.
  useEffect(() => {
    if (state.kind !== "checking") return;
    if (state.line !== "Scanning operator registry…") return;
    if (!connected || !publicKey) return;
    if (resolveOnce.current) return;
    resolveOnce.current = true;

    let cancelled = false;
    (async () => {
      const wallet = publicKey.toBase58();

      // 1) Establish a session cookie via wallet-gate (same endpoint /manage uses).
      try {
        const gate = await fetch("/api/auth/wallet-gate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: wallet }),
        });
        const gateBody = (await gate.json().catch(() => null)) as
          | { ok: boolean; reason?: string }
          | null;
        if (cancelled) return;
        if (!gate.ok || !gateBody?.ok) {
          // Wallet-gate failed — could be no_terminal / wallet_not_registered /
          // tid_reset. From the chad modal's perspective, all three mean
          // "this wallet doesn't have a usable LASTPROOF profile yet" → land on
          // the no-profile screen which points the user at /manage to onboard.
          const reason = gateBody?.reason ?? "gate_failed";
          if (
            reason === "no_terminal" ||
            reason === "wallet_not_registered" ||
            reason === "tid_reset"
          ) {
            setState({ kind: "no-profile-from-gate" });
          } else {
            setState({ kind: "error", reason });
          }
          return;
        }
      } catch {
        if (!cancelled) setState({ kind: "error", reason: "network" });
        return;
      }

      // 2) Session exists — resolve chad eligibility.
      try {
        const res = await fetch(
          `/api/chads/eligibility?target=${encodeURIComponent(targetHandle)}`,
        );
        if (cancelled) return;
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { reason?: string } | null;
          setState({ kind: "error", reason: body?.reason ?? "unknown" });
          return;
        }
        const body = (await res.json()) as { ok: boolean; resolution?: PhaseResolution };
        if (!body.ok || !body.resolution) {
          setState({ kind: "error", reason: "bad_response" });
          return;
        }
        setState({ kind: "resolved", resolution: body.resolution });
      } catch {
        if (!cancelled) setState({ kind: "error", reason: "network" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state, connected, publicKey, targetHandle]);

  const handleConnect = useCallback(async () => {
    if (state.kind !== "connect") return;
    if (wallets.length === 0) {
      setState({ kind: "error", reason: "no_wallet_adapter" });
      return;
    }
    try {
      // select() sets the active adapter, then connect() triggers the
      // wallet popup. autoConnect is false in the WalletBoundary so
      // connect() must be called explicitly. Same pattern as ManageTerminal.
      select(wallets[0]!.adapter.name);
      await new Promise((r) => setTimeout(r, 100));
      await wallets[0]!.adapter.connect();
    } catch {
      // User rejected the wallet popup or the adapter errored. Stay on
      // the connect screen so they can retry.
    }
  }, [state.kind, wallets, select]);

  const submit = useCallback(async () => {
    if (state.kind !== "resolved") return;
    setState({ kind: "submitting", resolution: state.resolution });
    try {
      const res = await fetch("/api/chads/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: targetHandle }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { reason?: string } | null;
        setState({ kind: "error", reason: body?.reason ?? "request_failed" });
        return;
      }
      setState({ kind: "success", resolution: state.resolution });
    } catch {
      setState({ kind: "error", reason: "network" });
    }
  }, [state, targetHandle]);

  const finishAndClose = useCallback(async () => {
    try {
      await disconnect();
    } catch {
      // disconnect can fail silently; not user-visible.
    }
    onClose();
  }, [disconnect, onClose]);

  // Display values for the persistent ref-row (connected wallet pill +
  // target arrow). Read from useWallet() — pure display, no functional
  // change. Adapter name + truncated pubkey appear after connect.
  const walletAdapterName =
    (publicKey && wallets[0]?.adapter?.name) || null;
  const walletPubkeyShort = publicKey
    ? (() => {
        const s = publicKey.toBase58();
        return `${s.slice(0, 4)}…${s.slice(-4)}`;
      })()
    : null;
  const isConnected = Boolean(connected && publicKey);

  return (
    <div className="add-chad-modal-backdrop" onClick={onClose}>
      <div
        className="add-chad-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="acm-titlebar">
          <span className="acm-dot acm-dot-r" />
          <span className="acm-dot acm-dot-y" />
          <span className="acm-dot acm-dot-g" />
          <span className="acm-title">lastproof — add chad</span>
          <span className="acm-titlebar-right">
            <span className="acm-titlebar-pulse" />
            CHAD
          </span>
          <button type="button" className="acm-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {/* Persistent ref row — connected wallet pill + target preview.
            Visible across all phases; styled differently when no wallet
            is connected yet. */}
        <div className="acm-ref-row">
          <div
            className={`acm-conn-pill${isConnected ? "" : " disconnected"}`}
          >
            <span className="acm-conn-dot" />
            <span className="acm-conn-label">
              {isConnected ? "CONNECTED" : "NO WALLET"}
            </span>
            <span>
              {isConnected
                ? `${(walletAdapterName ?? "WALLET").toUpperCase()} · ${walletPubkeyShort}`
                : "CONNECT BELOW ↓"}
            </span>
          </div>
          <div className="acm-target-pill">
            <span className="acm-target-pill-avatar">
              {targetAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={targetAvatarUrl} alt={`@${targetHandle}`} />
              ) : (
                (targetDisplayName || targetHandle).slice(0, 1).toUpperCase()
              )}
            </span>
            <span className="acm-arrow">→</span>
            <span className="acm-target-pill-handle">@{targetHandle}</span>
          </div>
        </div>

        <div className="acm-body">
          <PhaseBody
            state={state}
            targetHandle={targetHandle}
            targetDisplayName={targetDisplayName}
            targetAvatarUrl={targetAvatarUrl}
            connecting={connecting}
            onConnect={handleConnect}
            onSubmit={submit}
            onClose={onClose}
            onFinish={finishAndClose}
          />
        </div>

        <div className="acm-fine">
          CHAD GRAPH IS WALLET-KEYED · ONE WALLET · ONE ARMY
        </div>
      </div>
    </div>
  );
}

function PhaseBody({
  state,
  targetHandle,
  targetDisplayName,
  targetAvatarUrl,
  connecting,
  onConnect,
  onSubmit,
  onClose,
  onFinish,
}: {
  state: ClientState;
  targetHandle: string;
  targetDisplayName: string;
  targetAvatarUrl: string | null;
  connecting: boolean;
  onConnect: () => void;
  onSubmit: () => void;
  onClose: () => void;
  onFinish: () => void;
}) {
  // ── Screen 1: connect ──────────────────────────────────────────────
  // FUNCTIONAL CHANGES PROHIBITED on this screen — keep the single
  // CONNECT WALLET button (wallet-adapter pops its own picker). Only
  // the surrounding chrome (eyebrow, headline, subcopy, info card) is
  // added per the wireframe v0.4 polish.
  if (state.kind === "connect") {
    const targetDisplay = targetDisplayName || `@${targetHandle}`;
    return (
      <div className="acm-phase acm-phase-connect">
        <div className="acm-eyebrow">WALLET REQUIRED</div>
        <h3 className="acm-headline">
          Connect to add{" "}
          <span className="acm-accent-green">@{targetHandle}</span>.
        </h3>
        <p className="acm-copy">
          Chad asks are wallet-signed. Connect a Solana wallet to send. We
          don&apos;t move funds — this is a signed identity proof, nothing more.
        </p>

        <div className="acm-target-preview">
          {targetAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="acm-target-avatar" src={targetAvatarUrl} alt={`@${targetHandle}`} />
          ) : (
            <div className="acm-target-avatar acm-target-avatar-fallback">
              {(targetDisplayName || targetHandle).slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="acm-target-name">{targetDisplay}</div>
          <div className="acm-target-handle">@{targetHandle}</div>
        </div>

        <button
          type="button"
          className="acm-cta acm-cta-primary acm-connect-btn"
          onClick={onConnect}
          disabled={connecting}
        >
          {connecting ? "CONNECTING…" : "CONNECT WALLET"}
        </button>
        <div className="acm-connect-sub">Phantom, Solflare, Backpack</div>
        <a className="acm-safe-link" href="/manage/safety">
          Is it safe to connect my wallet?
        </a>

        <div className="acm-info-card acm-info-dim">
          <div className="acm-info-title">WHY A WALLET?</div>
          <div className="acm-info-body">
            The chad graph is wallet-keyed. One wallet = one node = one army.
            No social account, no email, no identity gymnastics.{" "}
            <b>If you already have a profile on /manage, use that wallet.</b>
          </div>
        </div>
      </div>
    );
  }

  // ── Screen 2: checking ─────────────────────────────────────────────
  if (state.kind === "checking") {
    return (
      <div className="acm-phase acm-phase-checking">
        <div className="acm-eyebrow acm-eyebrow-green">CHECKING ELIGIBILITY</div>
        <h3 className="acm-headline">
          Resolving{" "}
          <span className="acm-accent-green">relationship</span>…
        </h3>
        <div className="acm-spinner" aria-hidden="true" />
        <div className="acm-pending-status">{state.line}</div>
      </div>
    );
  }

  // ── Errors ──────────────────────────────────────────────────────────
  if (state.kind === "error") {
    return (
      <div className="acm-phase acm-phase-error">
        <div className="acm-eyebrow acm-eyebrow-red">ERROR</div>
        <h3 className="acm-headline">Something went wrong.</h3>
        <p className="acm-copy acm-copy-dim">[{state.reason}]</p>
        <button type="button" className="acm-cta acm-cta-dim" onClick={onClose}>&gt; CLOSE</button>
      </div>
    );
  }

  // Wallet-gate failure that means "no usable profile" → render the
  // no-profile screen using the pre-known target name (eligibility was
  // never reached so we don't have a resolution object).
  if (state.kind === "no-profile-from-gate") {
    return (
      <div className="acm-phase acm-phase-no-profile">
        <div className="acm-done-check acm-done-check-small acm-done-check-gold" aria-hidden="true">
          <svg className="acm-done-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </div>
        <div className="acm-eyebrow acm-eyebrow-gold">NO PROFILE ON THIS WALLET</div>
        <h3 className="acm-headline">
          Build a <span className="acm-accent-gold">LASTPROOF profile.</span>
        </h3>
        <p className="acm-copy">
          This wallet hasn&apos;t built a LASTPROOF profile yet. Build one and
          get discovered by hirers across the LASTPROOF grid.
        </p>
        <div className="acm-info-card acm-info-gold">
          <div className="acm-info-title">UNDER 60 SECONDS</div>
          <div className="acm-info-body">
            Claim a handle, drop in 1–3 work items, publish. Building your{" "}
            <b>Chad Army</b> is one of several premium benefits — once your
            profile is live and active, you can send and receive chad asks too.
          </div>
        </div>
        <a className="acm-cta acm-cta-gold" href="/manage">&gt; BUILD YOUR PROFILE ↗</a>
      </div>
    );
  }

  // From here on we have a resolution.
  const { resolution } = state;
  const target = resolution.target;
  const targetDisplay = target.displayName || `@${target.handle}`;

  if (state.kind === "submitting") {
    return (
      <div className="acm-phase acm-phase-submitting">
        <div className="acm-eyebrow acm-eyebrow-accent">SUBMITTING ASK</div>
        <h3 className="acm-headline">
          Sending to{" "}
          <span className="acm-accent-accent">@{target.handle}</span>…
        </h3>
        <div className="acm-spinner" aria-hidden="true" />
        <div className="acm-pending-status">RECORDING ASK</div>
      </div>
    );
  }

  if (state.kind === "success") {
    return (
      <div className="acm-phase acm-phase-success">
        <div className="acm-done-check" aria-hidden="true">
          <svg className="acm-done-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="acm-eyebrow acm-eyebrow-green">ASK SENT · WALLET WILL DISCONNECT</div>
        <h3 className="acm-headline">
          Sent to <span className="acm-accent-green">@{target.handle}</span>.
        </h3>
        <p className="acm-copy">
          It&apos;s in their dashboard. If they accept, they&apos;ll appear in{" "}
          <b>your</b> Chad Army. We&apos;ll disconnect your wallet and return
          you to the profile.
        </p>
        <div className="acm-status-summary">
          <div className="acm-ss-row">
            <span className="acm-ss-key">TO</span>
            <span className="acm-ss-val">@{target.handle}</span>
          </div>
          <div className="acm-ss-row">
            <span className="acm-ss-key">STATUS</span>
            <span className="acm-ss-val acm-ss-accent">PENDING</span>
          </div>
          <div className="acm-ss-row">
            <span className="acm-ss-key">WALLET</span>
            <span className="acm-ss-val acm-ss-dim">WILL DISCONNECT ON RETURN</span>
          </div>
        </div>
        <button type="button" className="acm-cta acm-cta-primary" onClick={onFinish}>
          &gt; DISCONNECT &amp; BACK TO PROFILE
        </button>
      </div>
    );
  }

  switch (resolution.phase) {
    case "eligible":
      return (
        <div className="acm-phase acm-phase-eligible">
          <div className="acm-eyebrow acm-eyebrow-green">READY TO SEND</div>
          <h3 className="acm-headline">
            Add{" "}
            <span className="acm-accent-green">@{target.handle}</span>{" "}
            to your Chad Army?
          </h3>
          <p className="acm-copy">
            Your ask lands in their dashboard. They can accept, deny, or
            ignore. While it&apos;s pending, you can&apos;t send another to
            the same operator.
          </p>

          <div className="acm-target-card">
            <div className="acm-target-label">CHAD ASK TARGET</div>
            <div className="acm-target-name">{targetDisplay}</div>
            <div className="acm-target-handle">@{target.handle}</div>
          </div>

          <div className="acm-info-card">
            <div className="acm-info-title">WHAT HAPPENS NEXT</div>
            <ul className="acm-info-body">
              <li>
                Ask lands in <b>@{target.handle}&apos;s</b> dashboard with [Accept] / [Deny].
              </li>
              <li>
                <b>Accept</b> → they appear in <b>your</b> Chad Army. Your
                public profile updates.
              </li>
              <li>
                <b>Deny</b> → ask is silently removed. You can re-ask later.
              </li>
              <li>
                <b>No action</b> → ask stays pending. You can&apos;t re-send
                while pending.
              </li>
              <li>
                <i>Note:</i> their army doesn&apos;t change unless they send
                their own ask back.
              </li>
            </ul>
          </div>

          <button type="button" className="acm-cta acm-cta-primary" onClick={onSubmit}>
            &gt; SEND CHAD ASK
          </button>
        </div>
      );
    case "already":
      return (
        <div className="acm-phase acm-phase-already">
          <div className="acm-done-check acm-done-check-small acm-done-check-soft" aria-hidden="true">
            <svg className="acm-done-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="acm-eyebrow acm-eyebrow-green">ALREADY IN YOUR ARMY</div>
          <h3 className="acm-headline">
            <span className="acm-accent-green">@{target.handle}</span> is in
            your Chad Army.
          </h3>
          <p className="acm-copy">
            You added them. They appear in your public Chad Army on every
            render of your profile.
          </p>
          <div className="acm-status-summary">
            <div className="acm-ss-row">
              <span className="acm-ss-key">IN YOUR ARMY</span>
              <span className="acm-ss-val acm-ss-green">YES</span>
            </div>
            <div className="acm-ss-row">
              <span className="acm-ss-key">REMOVE</span>
              <span className="acm-ss-val acm-ss-dim">/manage/chads</span>
            </div>
          </div>
          <div className="acm-info-card acm-info-dim">
            <div className="acm-info-body">
              <b>Remove</b> takes them out of your army. They don&apos;t get
              notified. Manage your army at <b>/manage/chads</b>.
            </div>
          </div>
          <button type="button" className="acm-cta acm-cta-dim" onClick={onClose}>
            &gt; BACK TO PROFILE
          </button>
        </div>
      );
    case "pending":
      return (
        <div className="acm-phase acm-phase-pending">
          <div className="acm-done-check acm-done-check-small acm-done-check-accent" aria-hidden="true">
            <svg className="acm-done-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="acm-eyebrow acm-eyebrow-accent">YOUR ASK IS PENDING</div>
          <h3 className="acm-headline">
            Waiting on{" "}
            <span className="acm-accent-accent">@{target.handle}</span>.
          </h3>
          <p className="acm-copy">
            You already sent a chad ask. It&apos;s in their dashboard.
            Re-sending is locked while it&apos;s pending.
          </p>
          <div className="acm-status-summary">
            <div className="acm-ss-row">
              <span className="acm-ss-key">TO</span>
              <span className="acm-ss-val acm-ss-accent">@{target.handle}</span>
            </div>
            <div className="acm-ss-row">
              <span className="acm-ss-key">STATUS</span>
              <span className="acm-ss-val acm-ss-accent">AWAITING RESPONSE</span>
            </div>
          </div>
          <button type="button" className="acm-cta acm-cta-dim" onClick={onClose}>
            &gt; BACK TO PROFILE
          </button>
        </div>
      );
    case "free":
      return (
        <div className="acm-phase acm-phase-free">
          <div className="acm-done-check acm-done-check-small acm-done-check-purple" aria-hidden="true">
            <svg className="acm-done-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div className="acm-eyebrow acm-eyebrow-purple">UPGRADE YOUR PROFILE</div>
          <h3 className="acm-headline">
            Go <span className="acm-accent-purple">Premium.</span>
          </h3>
          <p className="acm-copy">
            Premium profiles are visible on the LASTPROOF grid, earn tier
            badges, build a Chad Army, and get the full suite of trust signals.
            One payment, 30 days.
          </p>
          <div className="acm-info-card acm-info-purple">
            <div className="acm-info-title">PREMIUM INCLUDES</div>
            <div className="acm-info-body">
              <ul style={{ margin: "6px 0 0", paddingLeft: 20, textAlign: "left" }}>
                <li><b>Grid listing</b> — discoverable by hirers</li>
                <li><b>Tier badges</b> — New, Verified, Experienced, Legend</li>
                <li><b>Verification badge</b> — X &amp; Telegram</li>
                <li><b>Hire button</b> — DMs from your profile</li>
                <li><b>Minting</b> — lock top work on-chain</li>
                <li>
                  <b>Chad Army</b> — send and receive chad asks, appear in
                  others&apos; armies
                </li>
                <li><b>30 days</b> — renew early, time rolls over</li>
              </ul>
            </div>
          </div>
          <a className="acm-cta acm-cta-purple" href="/manage">&gt; UPGRADE TO PREMIUM ↗</a>
        </div>
      );
    case "no-profile":
      return (
        <div className="acm-phase acm-phase-no-profile">
          <div className="acm-done-check acm-done-check-small acm-done-check-gold" aria-hidden="true">
            <svg className="acm-done-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </div>
          <div className="acm-eyebrow acm-eyebrow-gold">NO PROFILE ON THIS WALLET</div>
          <h3 className="acm-headline">
            Build a <span className="acm-accent-gold">LASTPROOF profile.</span>
          </h3>
          <p className="acm-copy">
            This wallet hasn&apos;t built a LASTPROOF profile yet. Build one
            and get discovered by hirers across the LASTPROOF grid.
          </p>
          <div className="acm-info-card acm-info-gold">
            <div className="acm-info-title">UNDER 60 SECONDS</div>
            <div className="acm-info-body">
              Claim a handle, drop in 1–3 work items, publish. Building your{" "}
              <b>Chad Army</b> is one of several premium benefits — once your
              profile is live and active, you can send and receive chad asks too.
            </div>
          </div>
          <a className="acm-cta acm-cta-gold" href="/manage">&gt; BUILD YOUR PROFILE ↗</a>
        </div>
      );
    case "own":
      return (
        <div className="acm-phase acm-phase-own">
          <div className="acm-done-check acm-done-check-small acm-done-check-dim" aria-hidden="true">
            <svg className="acm-done-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="acm-eyebrow acm-eyebrow-dim">THAT&apos;S YOU</div>
          <h3 className="acm-headline">
            You can&apos;t{" "}
            <span className="acm-accent-dim">add yourself</span>.
          </h3>
          <p className="acm-copy acm-copy-dim">
            This wallet owns the profile you&apos;re viewing. Share your
            profile with someone else to grow your army — they&apos;ll see the
            [+ ADD CHAD] button on your public page.
          </p>
          <div className="acm-info-card acm-info-dim">
            <div className="acm-info-body">
              Your profile link:{" "}
              <b>lastproof.app/@{target.handle}</b>
            </div>
          </div>
          <button type="button" className="acm-cta acm-cta-dim" onClick={onClose}>
            &gt; CLOSE
          </button>
        </div>
      );
  }
}
