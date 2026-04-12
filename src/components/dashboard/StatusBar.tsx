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
import { PaymentModal } from "@/components/payment-modal/PaymentModal";

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
      // Path A: read ref from URL searchParams (carried through onboarding)
      const urlRef = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("ref") ?? undefined
        : undefined;
      const res = await fetch("/api/campaign/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: urlRef }),
      });
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
    // Paid path — open PaymentModal
    setShowUpgrade(true);
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

      {/* Subscription payment modal */}
      {showUpgrade && (
        <PaymentModal
          open={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          kind="subscription"
          onSuccess={() => {
            setShowUpgrade(false);
            // Webhook will extend subscription — reload to pick it up.
            setTimeout(() => window.location.reload(), 3000);
          }}
        />
      )}
    </>
  );
}
