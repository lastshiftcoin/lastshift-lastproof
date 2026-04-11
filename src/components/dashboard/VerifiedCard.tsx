"use client";

/**
 * VerifiedCard — X and Telegram verification for the blue checkmark.
 *
 * - X: OAuth 2.0 with PKCE via full-page redirect
 * - Telegram: popup to lastshift.ai bridge page → Login Widget there →
 *   postMessage back with signed data → POST to our backend for HMAC verify
 *
 * The Telegram Login Widget requires a custom domain (*.vercel.app
 * subdomains don't deliver confirmation messages). The bridge page
 * on lastshift.ai hosts the widget; auth data comes back via postMessage.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { ProfileRow } from "@/lib/profiles-store";

interface TelegramAuthUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface VerifiedCardProps {
  profile: ProfileRow;
  onProfileUpdate?: (profile: ProfileRow) => void;
}

const BRIDGE_URL = "https://lastshift.ai/auth/telegram-bridge";

export function VerifiedCard({ profile, onProfileUpdate }: VerifiedCardProps) {
  const [xHandle, setXHandle] = useState(profile.xHandle ?? "");
  const [tgHandle, setTgHandle] = useState(profile.tgHandle ?? "");
  const [xVerified, setXVerified] = useState(profile.xVerified);
  const [tgVerified, setTgVerified] = useState(profile.tgVerified);
  const [xSaving, setXSaving] = useState(false);
  const [tgSaving, setTgSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tgConnecting, setTgConnecting] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const isPaid = profile.isPaid;
  const xLinked = !!xHandle;
  const tgLinked = !!tgHandle;
  const bothVerified = xVerified && tgVerified;
  const progressPct = (xVerified ? 50 : 0) + (tgVerified ? 50 : 0);

  // Detect ?verified=x on mount (X OAuth callback return)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get("verified");
    const verifyError = params.get("verify_error");
    const reason = params.get("reason");

    if (verified === "x" || verified === "tg") {
      setSuccessMsg(
        `${verified === "x" ? "X / Twitter" : "Telegram"} verified!`,
      );
      const url = new URL(window.location.href);
      url.searchParams.delete("verified");
      window.history.replaceState({}, "", url.pathname);
      if (onProfileUpdate) {
        fetch("/api/dashboard/profile")
          .then((r) => r.json())
          .then((data) => {
            if (data.profile) onProfileUpdate(data.profile);
          })
          .catch(() => {});
      }
    } else if (verifyError) {
      const platform = verifyError === "x" ? "X / Twitter" : "Telegram";
      const messages: Record<string, string> = {
        denied: `${platform} authorization was denied.`,
        expired: "Session expired. Please try again.",
        state_mismatch: "Security check failed. Please try again.",
        token_exchange: `Failed to complete ${platform} authorization.`,
        user_fetch: `Could not retrieve your ${platform} username.`,
        handle_taken: `This ${platform} account is already linked to another LASTPROOF profile.`,
        no_session:
          "You're not logged in. Please connect your wallet first.",
        db_error: "Database error. Please try again.",
      };
      setErrorMsg(
        messages[reason ?? ""] ?? `${platform} verification failed.`,
      );
      const url = new URL(window.location.href);
      url.searchParams.delete("verify_error");
      url.searchParams.delete("reason");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [onProfileUpdate]);

  // Sync state when profile prop updates
  useEffect(() => {
    setXHandle(profile.xHandle ?? "");
    setTgHandle(profile.tgHandle ?? "");
    setXVerified(profile.xVerified);
    setTgVerified(profile.tgVerified);
  }, [profile.xHandle, profile.tgHandle, profile.xVerified, profile.tgVerified]);

  // Auto-dismiss messages
  useEffect(() => {
    if (successMsg || errorMsg) {
      const t = setTimeout(() => {
        setSuccessMsg(null);
        setErrorMsg(null);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [successMsg, errorMsg]);

  // Handle Telegram auth data received via postMessage from bridge popup
  const handleTelegramAuth = useCallback(
    async (user: TelegramAuthUser) => {
      setTgConnecting(true);

      try {
        const res = await fetch("/api/auth/telegram/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        });

        const data = await res.json();

        if (!res.ok) {
          const messages: Record<string, string> = {
            hash_mismatch: "Telegram verification failed — invalid signature.",
            expired_auth: "Telegram auth expired. Please try again.",
            no_username:
              "Your Telegram account has no username. Set one in Telegram Settings first.",
            handle_taken:
              "This Telegram account is already linked to another LASTPROOF profile.",
            no_session:
              "You're not logged in. Please connect your wallet first.",
            db_error: "Database error. Please try again.",
          };
          setErrorMsg(
            messages[data.error] ?? "Telegram verification failed.",
          );
          return;
        }

        setTgHandle(data.handle);
        setTgVerified(true);
        setSuccessMsg("Telegram verified!");

        if (onProfileUpdate) {
          fetch("/api/dashboard/profile")
            .then((r) => r.json())
            .then((d) => {
              if (d.profile) onProfileUpdate(d.profile);
            })
            .catch(() => {});
        }
      } catch {
        setErrorMsg("Telegram verification failed — network error.");
      } finally {
        setTgConnecting(false);
      }
    },
    [onProfileUpdate],
  );

  // Listen for postMessage from the bridge popup
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      // Only accept messages from lastshift.ai
      if (e.origin !== "https://lastshift.ai") return;
      if (e.data?.type !== "telegram-auth") return;

      const user = e.data.payload as TelegramAuthUser;
      if (user?.id && user?.hash && user?.auth_date) {
        handleTelegramAuth(user);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [handleTelegramAuth]);

  // Open bridge popup for Telegram auth
  function openTelegramBridge() {
    const origin = window.location.origin;
    const url = `${BRIDGE_URL}?origin=${encodeURIComponent(origin)}`;

    const w = 450;
    const h = 500;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;

    popupRef.current = window.open(
      url,
      "telegram-bridge",
      `width=${w},height=${h},left=${left},top=${top},popup=yes`,
    );

    // Poll for popup close (user cancelled)
    const check = setInterval(() => {
      if (popupRef.current?.closed) {
        clearInterval(check);
        popupRef.current = null;
      }
    }, 500);
  }

  async function unlinkPlatform(platform: "x" | "tg") {
    if (
      !confirm(
        `Disconnect ${platform === "x" ? "X / Twitter" : "Telegram"}?`,
      )
    )
      return;

    const setSaving = platform === "x" ? setXSaving : setTgSaving;
    setSaving(true);

    try {
      const res = await fetch("/api/dashboard/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, handle: null }),
      });

      if (!res.ok) {
        alert("Disconnect failed");
        return;
      }

      if (platform === "x") {
        setXHandle("");
        setXVerified(false);
      } else {
        setTgHandle("");
        setTgVerified(false);
      }
    } catch {
      alert("Disconnect failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="edit-card" style={!isPaid ? { opacity: 0.4, pointerEvents: "none" } : undefined}>
      <div className="edit-head">
        <div className="edit-title">GET VERIFIED</div>
        {!isPaid && (
          <div style={{
            fontFamily: "var(--mono)",
            fontSize: 9,
            letterSpacing: 0.5,
            color: "var(--text-dim, #666)",
          }}>
            UPGRADE TO UNLOCK
          </div>
        )}
      </div>

      {/* Success/error toast */}
      {successMsg && (
        <div
          style={{
            padding: "8px 12px",
            margin: "0 0 12px",
            borderRadius: 4,
            background: "rgba(0,230,118,0.1)",
            border: "1px solid var(--green)",
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "var(--green)",
            letterSpacing: 0.5,
          }}
        >
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div
          style={{
            padding: "8px 12px",
            margin: "0 0 12px",
            borderRadius: 4,
            background: "rgba(255,107,107,0.1)",
            border: "1px solid #ff6b6b",
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "#ff6b6b",
            letterSpacing: 0.5,
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Badge + copy */}
      <div className="verify-wrap">
        <div className={`verify-badge${bothVerified ? "" : " locked"}`}>
          <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M60 6 L74 16 L91 14 L96 31 L110 41 L104 58 L110 75 L96 85 L91 102 L74 100 L60 110 L46 100 L29 102 L24 85 L10 75 L16 58 L10 41 L24 31 L29 14 L46 16 Z"
              fill="#409eff"
              stroke="#7eb8ff"
              strokeWidth="1.5"
            />
          </svg>
          <span className="check">{"\u2713"}</span>
        </div>
        <div className="verify-copy">
          <div className="verify-headline">
            Earn the <span className="blue">blue checkmark</span>
          </div>
          <div className="verify-sub">
            Link X and Telegram to unlock the badge. Telegram is required
            for the HIRE button.
          </div>
          <div className="verify-progress">
            <div className="verify-bar">
              <div
                className="verify-bar-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Platform rows */}
      <div className="verify-rows">
        {/* X / Twitter */}
        <div className={`verify-row${xLinked ? " linked" : ""}`}>
          <div className="vr-icon x">{"\ud835\udd4f"}</div>
          <div className="vr-meta">
            <div className="vr-name">X / Twitter</div>
            {xLinked ? (
              <div className="vr-handle connected">
                @{xHandle}
                {xVerified && (
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 8,
                      letterSpacing: 1,
                      color: "var(--green)",
                      marginLeft: 8,
                    }}
                  >
                    VERIFIED
                  </span>
                )}
              </div>
            ) : (
              <div className="vr-handle">not connected</div>
            )}
          </div>
          {xLinked ? (
            <button
              type="button"
              className="vr-action disconnect"
              onClick={() => unlinkPlatform("x")}
              disabled={xSaving}
            >
              {xSaving ? "..." : "DISCONNECT"}
            </button>
          ) : (
            <button
              type="button"
              className="vr-action connect"
              onClick={() => {
                window.location.href = "/api/auth/x/authorize";
              }}
            >
              CONNECT
            </button>
          )}
        </div>

        {/* Telegram */}
        <div className={`verify-row${tgLinked ? " linked" : ""}`}>
          <div className="vr-icon tg">T</div>
          <div className="vr-meta">
            <div className="vr-name">Telegram</div>
            {tgLinked ? (
              <div className="vr-handle connected">
                @{tgHandle}
                {tgVerified && (
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 8,
                      letterSpacing: 1,
                      color: "var(--green)",
                      marginLeft: 8,
                    }}
                  >
                    VERIFIED
                  </span>
                )}
              </div>
            ) : (
              <div className="vr-handle">required for HIRE button</div>
            )}
          </div>
          {tgLinked ? (
            <button
              type="button"
              className="vr-action disconnect"
              onClick={() => unlinkPlatform("tg")}
              disabled={tgSaving}
            >
              {tgSaving ? "..." : "DISCONNECT"}
            </button>
          ) : (
            <button
              type="button"
              className="vr-action connect"
              onClick={openTelegramBridge}
              disabled={tgConnecting}
            >
              {tgConnecting ? "VERIFYING..." : "CONNECT"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
