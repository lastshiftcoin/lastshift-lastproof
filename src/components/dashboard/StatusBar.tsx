"use client";

/**
 * StatusBar — profile status + subscription countdown + upgrade CTA.
 *
 * Wireframe: lastproof-dashboard.html `.status-bar`
 *
 * Shows:
 *   - Profile Status pill: ACTIVE (green) | PENDING (orange) | EXPIRED (red)
 *   - Subscription countdown (days remaining)
 *   - "Upgrade Profile" button — creates a subscription quote and shows
 *     payment details inline. Full payment modal is a future step.
 */

import { useState, useEffect } from "react";
import type { ProfileRow } from "@/lib/profiles-store";

interface StatusBarProps {
  profile: ProfileRow;
  /** When true, the upgrade button shows "SOLD OUT" and is disabled */
  campaignSoldOut?: boolean;
  /** Whether the campaign FOMO strip is showing (free upgrade available) */
  campaignActive?: boolean;
  /** Called after successful free claim to refresh profile data */
  onProfileUpdate?: (profile: ProfileRow) => void;
}

type ProfileStatus = "active" | "pending" | "expired";

function deriveStatus(profile: ProfileRow): ProfileStatus {
  if (!profile.isPaid) return "pending";
  if (!profile.publishedAt) return "pending";
  if (profile.subscriptionExpiresAt) {
    const expires = new Date(profile.subscriptionExpiresAt).getTime();
    if (expires < Date.now()) return "expired";
  }
  return "active";
}

function daysUntilExpiry(profile: ProfileRow): number | null {
  if (!profile.subscriptionExpiresAt) return null;
  const expires = new Date(profile.subscriptionExpiresAt).getTime();
  const diff = expires - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const STATUS_CONFIG: Record<ProfileStatus, { label: string; cls: string }> = {
  active: { label: "ACTIVE", cls: "active" },
  pending: { label: "PENDING", cls: "pending" },
  expired: { label: "EXPIRED", cls: "defunct" },
};

export function StatusBar({ profile, campaignSoldOut = false, campaignActive = false, onProfileUpdate }: StatusBarProps) {
  const [countdown, setCountdown] = useState<string>("--");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<{
    id: string;
    amountUsd: number;
    token: string;
    amountToken: string;
    treasury: string;
    reference: string;
    expiresAt: string;
  } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const status = deriveStatus(profile);
  const config = STATUS_CONFIG[status];

  useEffect(() => {
    const days = daysUntilExpiry(profile);
    if (days === null) {
      setCountdown("--");
    } else if (days === 0) {
      setCountdown("EXPIRED");
    } else {
      setCountdown(`${days}d`);
    }
  }, [profile]);

  async function handleFreeClaim() {
    setClaiming(true);
    try {
      const res = await fetch("/api/campaign/claim", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setClaimed(true);
        // Update profile in parent to reflect paid status
        onProfileUpdate?.({
          ...profile,
          isPaid: true,
          isEarlyAdopter: true,
          eaNumber: data.eaNumber ?? null,
          publishedAt: new Date().toISOString(),
          subscriptionExpiresAt: data.subscriptionExpiresAt ?? null,
        });
      } else if (data.reason === "sold_out") {
        // Campaign sold out while user was looking — fall through to paid upgrade
        setShowUpgrade(true);
      } else {
        alert(data.message || "Claim failed — please try again.");
      }
    } catch {
      alert("Claim failed — please try again.");
    } finally {
      setClaiming(false);
    }
  }

  async function handleUpgradeClick() {
    // Free claim path: campaign active + user not paid + not sold out
    if (campaignActive && !profile.isPaid && !campaignSoldOut) {
      handleFreeClaim();
      return;
    }
    if (status === "active") {
      // Already active — show renewal info
      setShowUpgrade(true);
      return;
    }
    setShowUpgrade(true);
  }

  async function requestQuote(token: "LASTSHFT" | "SOL" | "USDT") {
    setQuoteLoading(true);
    setQuoteError(null);
    setQuote(null);

    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "subscription", token }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setQuoteError(data.reason || data.error || "Quote failed");
        return;
      }

      const data = await res.json();
      setQuote({
        id: data.quoteId,
        amountUsd: data.amountUsd,
        token: data.token,
        amountToken: data.amountToken,
        treasury: data.treasury,
        reference: data.reference,
        expiresAt: data.expiresAt,
      });
    } catch {
      setQuoteError("Failed to get quote — please try again.");
    } finally {
      setQuoteLoading(false);
    }
  }

  return (
    <>
      <div className="status-bar" style={{ flexWrap: "wrap" }}>
        <div className="status-left">
          <div className="status-group">
            <span className="status-key">Profile Status</span>
            <span className={`status-pill ${config.cls}`}>
              <span className="dot" />
              {config.label}
            </span>
          </div>
          <span className="status-div" />
          <div className="status-group">
            <span className="status-note">expires in</span>
            <span className="status-count">{countdown}</span>
          </div>
        </div>
        <button
          type="button"
          className={`btn-upgrade${campaignSoldOut ? " btn-soldout" : ""}${claimed ? " btn-claimed" : ""}${campaignActive && !profile.isPaid && !campaignSoldOut ? " btn-free" : ""}`}
          onClick={(campaignSoldOut || claimed || claiming) ? undefined : handleUpgradeClick}
          disabled={campaignSoldOut || claimed || claiming}
          style={{ marginLeft: "auto" }}
        >
          {campaignSoldOut
            ? "SOLD OUT"
            : claimed
              ? "CLAIMED — ACTIVE"
              : claiming
                ? "CLAIMING..."
                : campaignActive && !profile.isPaid
                  ? "UPGRADE PROFILE"
                  : status === "active"
                    ? "Renew Profile"
                    : "Upgrade Profile"}
        </button>
      </div>

      {/* Upgrade / payment panel */}
      {showUpgrade && (
        <div style={{
          margin: "0 0 16px",
          padding: 18,
          background: "var(--bg-input)",
          border: "1px solid var(--border-2)",
          borderRadius: 8,
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}>
            <div style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              color: "var(--text)",
            }}>
              {status === "active" ? "RENEW SUBSCRIPTION" : "ACTIVATE PROFILE"}
            </div>
            <button
              type="button"
              onClick={() => { setShowUpgrade(false); setQuote(null); setQuoteError(null); }}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--text-dim)",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              CLOSE
            </button>
          </div>

          <div className="field-help" style={{ marginBottom: 14 }}>
            Profile subscription is <strong>$10 / 30 days</strong> (or <strong>$6</strong> with $LASTSHFT — 40% off).
            Pay with any supported token. Subscription activates instantly on confirmed payment.
          </div>

          {!quote && !quoteError && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-add"
                style={{ background: "rgba(255,145,0,.1)", color: "var(--accent)", border: "1px solid var(--accent)" }}
                onClick={() => requestQuote("LASTSHFT")}
                disabled={quoteLoading}
              >
                {quoteLoading ? "..." : "PAY WITH $LASTSHFT · $6"}
              </button>
              <button
                type="button"
                className="btn-add"
                onClick={() => requestQuote("SOL")}
                disabled={quoteLoading}
              >
                {quoteLoading ? "..." : "PAY WITH SOL · $10"}
              </button>
              <button
                type="button"
                className="btn-add"
                onClick={() => requestQuote("USDT")}
                disabled={quoteLoading}
              >
                {quoteLoading ? "..." : "PAY WITH USDT · $10"}
              </button>
            </div>
          )}

          {quoteError && (
            <div style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--red, #ef4444)",
              letterSpacing: 0.5,
              padding: "10px 0",
            }}>
              {quoteError}
              <button
                type="button"
                style={{
                  fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)",
                  background: "transparent", border: "none", cursor: "pointer",
                  marginLeft: 10, textDecoration: "underline",
                }}
                onClick={() => setQuoteError(null)}
              >
                TRY AGAIN
              </button>
            </div>
          )}

          {quote && (
            <div style={{
              padding: 14,
              background: "rgba(0,0,0,.2)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--text-2)",
              letterSpacing: 0.5,
            }}>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: "#fff" }}>Send exactly:</strong>{" "}
                <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                  {quote.amountToken} {quote.token}
                </span>{" "}
                <span style={{ color: "var(--text-dim)" }}>
                  (${quote.amountUsd})
                </span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: "#fff" }}>To treasury:</strong>{" "}
                <span style={{ wordBreak: "break-all" }}>{quote.treasury}</span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: "#fff" }}>Reference:</strong>{" "}
                <span style={{ wordBreak: "break-all" }}>{quote.reference}</span>
              </div>
              <div style={{ color: "var(--text-dim)" }}>
                Quote expires: {new Date(quote.expiresAt).toLocaleTimeString()}
              </div>
              <div className="field-help" style={{ marginTop: 10 }}>
                Send the exact amount with the reference memo. Payment confirms automatically via webhook.
                Page will update once the transaction is confirmed on-chain.
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
