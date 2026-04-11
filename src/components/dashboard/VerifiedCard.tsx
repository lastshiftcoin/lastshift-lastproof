"use client";

/**
 * VerifiedCard — X and Telegram verification for the blue checkmark.
 *
 * - X: OAuth 2.0 with PKCE via full-page redirect
 * - Telegram: Login Widget (script injection + JS callback + POST to backend)
 *   Uses the proven approach from telegram-auth-bot-implementation.md.
 *   Widget runs directly on the page in a modal — no redirect flow,
 *   no return_to URL, no domain matching issues.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { ProfileRow } from "@/lib/profiles-store";

// Extend window for Telegram widget callback
declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthUser) => void;
  }
}

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

export function VerifiedCard({ profile, onProfileUpdate }: VerifiedCardProps) {
  const [xHandle, setXHandle] = useState(profile.xHandle ?? "");
  const [tgHandle, setTgHandle] = useState(profile.tgHandle ?? "");
  const [xVerified, setXVerified] = useState(profile.xVerified);
  const [tgVerified, setTgVerified] = useState(profile.tgVerified);
  const [xSaving, setXSaving] = useState(false);
  const [tgSaving, setTgSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Telegram Login Widget state
  const [showTgWidget, setShowTgWidget] = useState(false);
  const [tgWidgetLoading, setTgWidgetLoading] = useState(false);
  const mountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const widgetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const xLinked = !!xHandle;
  const tgLinked = !!tgHandle;
  const bothVerified = xVerified && tgVerified;
  const progressPct = (xVerified ? 50 : 0) + (tgVerified ? 50 : 0);

  // Bot username from env (public, safe for client)
  const botUsername =
    process.env.NEXT_PUBLIC_TG_BOT_USERNAME ?? "lastproof_authbot";

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

  // Handle Telegram widget auth callback — POST data to our backend
  const handleTelegramAuth = useCallback(
    async (user: TelegramAuthUser) => {
      setShowTgWidget(false);
      setTgWidgetLoading(true);

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

        // Success
        setTgHandle(data.handle);
        setTgVerified(true);
        setSuccessMsg("Telegram verified!");

        // Refresh profile from server
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
        setTgWidgetLoading(false);
      }
    },
    [onProfileUpdate],
  );

  // Mount Telegram Login Widget when modal opens
  useEffect(() => {
    if (!showTgWidget) return;

    // Global callback — Telegram's widget calls this after auth
    window.onTelegramAuth = (user: TelegramAuthUser) => {
      handleTelegramAuth(user);
    };

    // Small delay to ensure modal DOM is painted
    mountTimeoutRef.current = setTimeout(() => {
      const container = document.getElementById("telegram-widget-container");
      if (!container) return;
      container.innerHTML = ""; // clear any previous widget

      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-widget.js?23";
      script.setAttribute("data-telegram-login", botUsername);
      script.setAttribute("data-size", "large");
      script.setAttribute("data-onauth", "onTelegramAuth(user)");
      script.setAttribute("data-request-access", "write");
      script.async = true;

      script.onerror = () => {
        setErrorMsg(
          "Telegram widget failed to load. Check your ad blocker.",
        );
        setShowTgWidget(false);
      };

      container.appendChild(script);

      // Timeout: if iframe hasn't appeared after 10s, show error
      widgetTimeoutRef.current = setTimeout(() => {
        if (container && !container.querySelector("iframe")) {
          setErrorMsg(
            "Telegram widget didn't load. Make sure telegram.org is not blocked.",
          );
          setShowTgWidget(false);
        }
      }, 10000);
    }, 50);

    return () => {
      if (mountTimeoutRef.current) clearTimeout(mountTimeoutRef.current);
      if (widgetTimeoutRef.current) clearTimeout(widgetTimeoutRef.current);
      delete window.onTelegramAuth;
    };
  }, [showTgWidget, botUsername, handleTelegramAuth]);

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
    <div className="edit-card">
      <div className="edit-head">
        <div className="edit-title">GET VERIFIED</div>
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
              onClick={() => setShowTgWidget(true)}
              disabled={tgWidgetLoading}
            >
              {tgWidgetLoading ? "VERIFYING..." : "CONNECT"}
            </button>
          )}
        </div>
      </div>

      {/* Telegram Login Widget modal — rendered via portal at body level
          so no parent stacking context can trap it behind other cards */}
      {showTgWidget &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 99999,
              background: "rgba(0,0,0,0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowTgWidget(false);
            }}
          >
            <div
              style={{
                background: "#1a1a2e",
                border: "1px solid #2a2a3e",
                borderRadius: 8,
                padding: "28px 32px",
                minWidth: 320,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  letterSpacing: 1.5,
                  color: "#fff",
                  marginBottom: 6,
                }}
              >
                CONNECT TELEGRAM
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "#666",
                  marginBottom: 20,
                }}
              >
                Click the button below to verify your Telegram account
              </div>

              {/* Widget mounts here */}
              <div
                id="telegram-widget-container"
                style={{
                  minHeight: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              />

              <button
                type="button"
                onClick={() => setShowTgWidget(false)}
                style={{
                  marginTop: 18,
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  letterSpacing: 1,
                  color: "#666",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 12px",
                }}
              >
                CANCEL
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
