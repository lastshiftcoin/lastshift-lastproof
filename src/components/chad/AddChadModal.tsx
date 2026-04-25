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
          <span className="acm-title">JOIN_CHAD_ARMY</span>
          <button type="button" className="acm-close" onClick={onClose} aria-label="Close">
            ×
          </button>
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
  if (state.kind === "connect") {
    return (
      <div className="acm-phase acm-phase-connect">
        <div className="acm-target-preview">
          {targetAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="acm-target-avatar" src={targetAvatarUrl} alt={`@${targetHandle}`} />
          ) : (
            <div className="acm-target-avatar acm-target-avatar-fallback">
              {(targetDisplayName || targetHandle).slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="acm-target-name">{targetDisplayName}</div>
          <div className="acm-target-handle">@{targetHandle}</div>
        </div>
        <div className="acm-connect-prompt">Connect Solana Wallet</div>
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
      </div>
    );
  }

  // ── Screen 2: checking ─────────────────────────────────────────────
  if (state.kind === "checking") {
    return (
      <div className="acm-phase acm-phase-checking">
        <div className="acm-spinner" aria-hidden="true" />
        <div className="acm-line">{state.line}</div>
      </div>
    );
  }

  // ── Errors ──────────────────────────────────────────────────────────
  if (state.kind === "error") {
    return (
      <div className="acm-phase acm-phase-error">
        <div className="acm-eyebrow acm-eyebrow-red">&gt; ERROR</div>
        <h3 className="acm-headline">Something went wrong.</h3>
        <p className="acm-copy acm-copy-dim">[{state.reason}]</p>
        <button type="button" className="acm-cta" onClick={onClose}>&gt; CLOSE</button>
      </div>
    );
  }

  // Wallet-gate failure that means "no usable profile" → render the
  // no-profile screen using the pre-known target name (eligibility was
  // never reached so we don't have a resolution object).
  if (state.kind === "no-profile-from-gate") {
    return (
      <div className="acm-phase acm-phase-no-profile">
        <div className="acm-eyebrow acm-eyebrow-gold">&gt; PROFILE REQUIRED</div>
        <h3 className="acm-headline">Create a LASTPROOF profile.</h3>
        <p className="acm-copy acm-copy-dim">
          Connecting with other operators is one of several premium benefits.
        </p>
        <a className="acm-cta acm-cta-primary" href="/manage">&gt; CREATE PROFILE</a>
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
        <div className="acm-spinner" aria-hidden="true" />
        <div className="acm-line">Sending ask…</div>
      </div>
    );
  }

  if (state.kind === "success") {
    return (
      <div className="acm-phase acm-phase-success">
        <div className="acm-done-check" aria-hidden="true">✓</div>
        <h3 className="acm-headline">Ask sent.</h3>
        <p className="acm-copy">
          {targetDisplay} can accept or deny from their dashboard. If they accept,
          they'll appear in your Chad Army.
        </p>
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
          <div className="acm-target-card">
            <div className="acm-target-label">CHAD ASK TARGET</div>
            <div className="acm-target-name">{targetDisplay}</div>
            <div className="acm-target-handle">@{target.handle}</div>
          </div>
          <div className="acm-info-card">
            <div className="acm-info-title">WHAT HAPPENS NEXT</div>
            <ul className="acm-info-body">
              <li>Your ask goes to {targetDisplay}'s dashboard.</li>
              <li>If they accept, they appear in your Chad Army.</li>
              <li>If they ignore or deny, nothing changes on your profile.</li>
            </ul>
          </div>
          <button type="button" className="acm-cta acm-cta-primary" onClick={onSubmit}>
            &gt; SEND ASK
          </button>
        </div>
      );
    case "already":
      return (
        <div className="acm-phase acm-phase-already">
          <div className="acm-done-check acm-done-check-soft" aria-hidden="true">✓</div>
          <h3 className="acm-headline">Already in your Chad Army.</h3>
          <p className="acm-copy">
            {targetDisplay} is in your Chad Army. To remove them, head to your dashboard.
          </p>
          <button type="button" className="acm-cta" onClick={onClose}>&gt; CLOSE</button>
        </div>
      );
    case "pending":
      return (
        <div className="acm-phase acm-phase-pending">
          <div className="acm-eyebrow acm-eyebrow-gold">&gt; ASK PENDING</div>
          <h3 className="acm-headline">Ask already sent.</h3>
          <p className="acm-copy">
            Awaiting their response. Check your dashboard.
          </p>
          <button type="button" className="acm-cta" onClick={onClose}>&gt; CLOSE</button>
        </div>
      );
    case "free":
      return (
        <div className="acm-phase acm-phase-free">
          <div className="acm-eyebrow acm-eyebrow-purple">&gt; PREMIUM REQUIRED</div>
          <h3 className="acm-headline">Activate your profile to send chad asks.</h3>
          <p className="acm-copy">
            Chad connections are part of the premium operator profile. Upgrade to send and receive requests.
          </p>
          <a className="acm-cta acm-cta-purple" href="/manage">&gt; UPGRADE PROFILE</a>
        </div>
      );
    case "no-profile":
      return (
        <div className="acm-phase acm-phase-no-profile">
          <div className="acm-eyebrow acm-eyebrow-gold">&gt; PROFILE REQUIRED</div>
          <h3 className="acm-headline">Create a LASTPROOF profile.</h3>
          <p className="acm-copy acm-copy-dim">
            Connecting with other operators is one of several premium benefits.
          </p>
          <a className="acm-cta acm-cta-primary" href="/manage">&gt; CREATE PROFILE</a>
        </div>
      );
    case "own":
      return (
        <div className="acm-phase acm-phase-own">
          <h3 className="acm-headline">That's your profile.</h3>
          <p className="acm-copy acm-copy-dim">You can't add yourself as a chad.</p>
          <button type="button" className="acm-cta" onClick={onClose}>&gt; CLOSE</button>
        </div>
      );
  }
}
