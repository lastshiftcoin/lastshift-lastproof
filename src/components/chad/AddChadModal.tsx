"use client";

/**
 * AddChadModal — the entire Add Chad experience. Opens from the static
 * `+ ADD CHAD` button on every public profile.
 *
 * Phases (server-side resolved via /api/chads/eligibility):
 *   eligible   — paid+published viewer, no relationship → submit CTA
 *   already    — chads exist; view-state, no Remove (Remove lives in dashboard)
 *   pending    — request already in flight (either direction); no resend
 *   free       — viewer's own profile is free → purple upgrade nudge
 *   no-profile — viewer's wallet has no profile → /manage CTA
 *   own        — viewer is the target → soft dead-end
 *
 * Pure client-side transients:
 *   connect    — no session yet → /manage CTA (we collapse "connect" with
 *                "no-profile" in this implementation, since the existing
 *                auth model requires a session created via /manage's wallet
 *                gate, not just a wallet-adapter connection).
 *   checking   — eligibility request in flight
 *   submitting — /api/chads/request in flight
 *   success    — request recorded; "DISCONNECT & BACK TO PROFILE"
 *
 * On success we trigger wallet-adapter disconnect + close. If the chad
 * accepts later, the requester sees the relationship reappear next time
 * they land on the profile.
 */

import { useCallback, useEffect, useState } from "react";
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

type ClientPhase =
  | { kind: "checking" }
  | { kind: "no-session" } // collapsed "connect" phase
  | { kind: "resolved"; resolution: PhaseResolution }
  | { kind: "submitting"; resolution: PhaseResolution }
  | { kind: "success"; resolution: PhaseResolution }
  | { kind: "error"; reason: string };

interface Props {
  targetHandle: string;
  onClose: () => void;
}

export function AddChadModal({ targetHandle, onClose }: Props) {
  const [state, setState] = useState<ClientPhase>({ kind: "checking" });
  const { disconnect } = useWallet();

  // Initial eligibility resolve.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/chads/eligibility?target=${encodeURIComponent(targetHandle)}`,
        );
        if (cancelled) return;
        if (res.status === 401) {
          setState({ kind: "no-session" });
          return;
        }
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
  }, [targetHandle]);

  // ESC closes.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

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
            onSubmit={submit}
            onClose={finishAndClose}
          />
        </div>
      </div>
    </div>
  );
}

function PhaseBody({
  state,
  onSubmit,
  onClose,
}: {
  state: ClientPhase;
  onSubmit: () => void;
  onClose: () => void;
}) {
  if (state.kind === "checking") {
    return (
      <div className="acm-phase acm-phase-checking">
        <div className="acm-spinner" aria-hidden="true" />
        <div className="acm-line">Scanning operator registry…</div>
      </div>
    );
  }

  if (state.kind === "no-session") {
    return (
      <div className="acm-phase acm-phase-no-session">
        <div className="acm-eyebrow">&gt; SIGN IN REQUIRED</div>
        <h3 className="acm-headline">Connect to LASTPROOF first.</h3>
        <p className="acm-copy">
          You'll need to sign in with your operator wallet before sending chad requests.
        </p>
        <a className="acm-cta acm-cta-primary" href="/manage">&gt; SIGN IN</a>
      </div>
    );
  }

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

  // Resolved phases — read from state.resolution.
  const { resolution } = state;
  const target = resolution.target;
  const targetDisplay = target.displayName || `@${target.handle}`;

  if (state.kind === "submitting") {
    return (
      <div className="acm-phase acm-phase-submitting">
        <div className="acm-spinner" aria-hidden="true" />
        <div className="acm-line">Sending chad request…</div>
      </div>
    );
  }

  if (state.kind === "success") {
    return (
      <div className="acm-phase acm-phase-success">
        <div className="acm-done-check" aria-hidden="true">✓</div>
        <h3 className="acm-headline">Request sent.</h3>
        <p className="acm-copy">
          {targetDisplay} can accept or deny from their dashboard. If they accept,
          you'll appear in each other's Chad Army.
        </p>
        <button type="button" className="acm-cta acm-cta-primary" onClick={onClose}>
          &gt; DISCONNECT &amp; BACK TO PROFILE
        </button>
      </div>
    );
  }

  // resolution.phase branches
  switch (resolution.phase) {
    case "eligible":
      return (
        <div className="acm-phase acm-phase-eligible">
          <div className="acm-target-card">
            <div className="acm-target-label">CHAD REQUEST TARGET</div>
            <div className="acm-target-name">{targetDisplay}</div>
            <div className="acm-target-handle">@{target.handle}</div>
          </div>
          <div className="acm-info-card">
            <div className="acm-info-title">WHAT HAPPENS NEXT</div>
            <ul className="acm-info-body">
              <li>Your request goes to {targetDisplay}'s dashboard.</li>
              <li>If they accept, you both appear in each other's Chad Army.</li>
              <li>If they ignore or deny, nothing changes on your profile.</li>
            </ul>
          </div>
          <button type="button" className="acm-cta acm-cta-primary" onClick={onSubmit}>
            &gt; SEND CHAD REQUEST
          </button>
        </div>
      );
    case "already":
      return (
        <div className="acm-phase acm-phase-already">
          <div className="acm-done-check acm-done-check-soft" aria-hidden="true">✓</div>
          <h3 className="acm-headline">Already in their Chad Army.</h3>
          <p className="acm-copy">
            You and {targetDisplay} are connected. To remove the connection, head to your dashboard.
          </p>
          <button type="button" className="acm-cta" onClick={onClose}>&gt; CLOSE</button>
        </div>
      );
    case "pending":
      return (
        <div className="acm-phase acm-phase-pending">
          <div className="acm-eyebrow acm-eyebrow-gold">&gt; REQUEST PENDING</div>
          <h3 className="acm-headline">Request already sent.</h3>
          <p className="acm-copy">
            There's already a request between you and {targetDisplay}. Check your dashboard.
          </p>
          <button type="button" className="acm-cta" onClick={onClose}>&gt; CLOSE</button>
        </div>
      );
    case "free":
      return (
        <div className="acm-phase acm-phase-free">
          <div className="acm-eyebrow acm-eyebrow-purple">&gt; PREMIUM REQUIRED</div>
          <h3 className="acm-headline">Activate your profile to send chad requests.</h3>
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
