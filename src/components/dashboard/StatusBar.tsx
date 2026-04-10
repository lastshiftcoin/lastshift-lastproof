"use client";

/**
 * StatusBar — profile status + subscription countdown + upgrade CTA.
 *
 * Wireframe: lastproof-dashboard.html `.status-bar`
 *
 * Shows:
 *   - Profile Status pill: ACTIVE (green) | PENDING (orange) | EXPIRED (red)
 *   - Subscription countdown (days remaining)
 *   - "Upgrade Profile" button (links to payment flow — stub for now)
 *
 * Read-only. Status derived from profile fields.
 */

import { useState, useEffect } from "react";
import type { ProfileRow } from "@/lib/profiles-store";

interface StatusBarProps {
  profile: ProfileRow;
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

export function StatusBar({ profile }: StatusBarProps) {
  const [countdown, setCountdown] = useState<string>("--");
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

  return (
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
        className="btn-upgrade"
        onClick={() => {
          // TODO: link to payment flow in Step 13
          alert("Payment flow coming soon");
        }}
      >
        Upgrade Profile
      </button>
    </div>
  );
}
