"use client";

/**
 * LinksCard — link organizer with platform tabs, add, delete, pin.
 *
 * Wireframe: lastproof-dashboard.html, LINKS section.
 *
 * - Platform tabs: ALL, Telegram, X, YouTube, Website
 * - Each link: icon, label, URL, pin toggle, delete
 * - Add link form
 * - Pinned links (up to 6) show on public profile, rest behind SHOW ALL
 *
 * Talks to /api/dashboard/links for CRUD.
 *
 * NOTE: DB `profile_links` needs `platform` and `pinned` columns (migration 0004).
 * Until then, all links are treated as platform="other" and pinned=false.
 */

import { useState } from "react";
import { useDebugLog } from "@/lib/debug/useDebugLog";

interface ProfileLink {
  id: string;
  label: string;
  url: string;
  platform: string;
  pinned: boolean;
  position: number;
}

interface LinksCardProps {
  initialLinks: ProfileLink[];
}

const PLATFORMS = ["all", "tg", "x", "yt", "web"] as const;
const PLATFORM_LABELS: Record<string, string> = {
  all: "ALL",
  tg: "TELEGRAM",
  x: "X",
  yt: "YOUTUBE",
  web: "WEBSITE",
};

const MAX_PINNED = 6;

function detectPlatform(url: string): string {
  if (url.includes("t.me") || url.includes("telegram")) return "tg";
  if (url.includes("twitter.com") || url.includes("x.com")) return "x";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "yt";
  return "web";
}

export function LinksCard({ initialLinks }: LinksCardProps) {
  const [links, setLinks] = useState<ProfileLink[]>(initialLinks.sort((a, b) => a.position - b.position));
  const [activeTab, setActiveTab] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addLabel, setAddLabel] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const debug = useDebugLog();

  // Bulk paste
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkAdding, setBulkAdding] = useState(false);

  const pinnedCount = links.filter((l) => l.pinned).length;

  // Filter
  const filtered = links.filter((l) => {
    if (activeTab !== "all" && l.platform !== activeTab) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.label.toLowerCase().includes(q) || l.url.toLowerCase().includes(q);
    }
    return true;
  });

  // Platform counts
  const counts: Record<string, number> = { all: links.length };
  for (const l of links) {
    counts[l.platform] = (counts[l.platform] ?? 0) + 1;
  }

  // ─── Add handler ────────────────────────────────────────────────────────
  async function handleAdd() {
    if (!addLabel.trim() || !addUrl.trim()) return;
    setAdding(true);

    const platform = detectPlatform(addUrl.trim());
    debug.log("proof_flow", "dashboard_link_add", { platform });
    try {
      const res = await fetch("/api/dashboard/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: addLabel.trim(),
          url: addUrl.trim(),
          platform,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        debug.log("error", "dashboard_link_add_failed", { status: res.status, error: data.error });
        alert(data.error || "Failed to add");
        return;
      }

      const { link } = await res.json();
      debug.log("proof_flow", "dashboard_link_add_ok", { id: link?.id, platform });
      setLinks((prev) => [...prev, link]);
      setAddLabel("");
      setAddUrl("");
      setShowAdd(false);
    } catch (err) {
      debug.log("error", "dashboard_link_add_network_error", { error: String(err) });
      alert("Failed to add — please try again.");
    } finally {
      setAdding(false);
    }
  }

  // ─── Delete handler ─────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    debug.log("proof_flow", "dashboard_link_delete", { id });
    try {
      const res = await fetch(`/api/dashboard/links?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        debug.log("proof_flow", "dashboard_link_delete_ok", { id });
        setLinks((prev) => prev.filter((l) => l.id !== id));
      } else {
        const data = await res.json().catch(() => ({}));
        debug.log("error", "dashboard_link_delete_failed", { status: res.status, error: data.error, id });
      }
    } catch (err) {
      debug.log("error", "dashboard_link_delete_network_error", { error: String(err), id });
      alert("Delete failed.");
    }
  }

  // ─── Bulk paste handler ──────────────────────────────────────────────────
  async function handleBulkAdd() {
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;
    setBulkAdding(true);
    debug.log("proof_flow", "dashboard_link_bulk_add", { lineCount: lines.length });

    const added: ProfileLink[] = [];
    let failedCount = 0;
    for (const line of lines) {
      // Parse: "Label — URL" or "Label - URL" or just "URL"
      let label = "";
      let url = line;
      const sepMatch = line.match(/^(.+?)\s*[—–\-|]\s*(https?:\/\/.+)$/i);
      if (sepMatch) {
        label = sepMatch[1].trim();
        url = sepMatch[2].trim();
      } else if (/^https?:\/\//.test(line)) {
        // Just a URL — derive label from domain
        try {
          const u = new URL(line);
          label = u.hostname.replace("www.", "");
        } catch {
          label = "Link";
        }
      } else {
        // Not a URL — skip
        continue;
      }

      try {
        const res = await fetch("/api/dashboard/links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label,
            url,
            platform: detectPlatform(url),
          }),
        });
        if (res.ok) {
          const { link } = await res.json();
          added.push(link);
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }
    }

    debug.log("proof_flow", "dashboard_link_bulk_add_done", { added: added.length, failed: failedCount });
    if (added.length > 0) {
      setLinks((prev) => [...prev, ...added]);
    }
    setBulkText("");
    setShowBulk(false);
    setBulkAdding(false);
  }

  // ─── Pin toggle ─────────────────────────────────────────────────────────
  const [pinSaved, setPinSaved] = useState(false);

  async function togglePin(id: string) {
    const link = links.find((l) => l.id === id);
    if (!link) return;
    const newPinned = !link.pinned;
    if (newPinned && pinnedCount >= MAX_PINNED) return;

    // Optimistic update
    setLinks((prev) => prev.map((l) =>
      l.id === id ? { ...l, pinned: newPinned } : l
    ));
    debug.log("proof_flow", "dashboard_link_pin_toggle", { id, newPinned });

    try {
      const res = await fetch("/api/dashboard/links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, pinned: newPinned }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        debug.log("error", "dashboard_link_pin_failed", { status: res.status, error: data.error, id });
        setLinks((prev) => prev.map((l) =>
          l.id === id ? { ...l, pinned: !newPinned } : l
        ));
      } else {
        debug.log("proof_flow", "dashboard_link_pin_ok", { id, newPinned });
        setPinSaved(true);
        setTimeout(() => setPinSaved(false), 1500);
      }
    } catch (err) {
      debug.log("error", "dashboard_link_pin_network_error", { error: String(err), id });
      setLinks((prev) => prev.map((l) =>
        l.id === id ? { ...l, pinned: !newPinned } : l
      ));
    }
  }

  return (
    <div className="edit-card" id="linksCard">
      <div className="edit-head">
        <div className="edit-title">LINKS</div>
        {pinSaved && (
          <span style={{
            fontFamily: "var(--mono)", fontSize: 10, color: "var(--green)",
            letterSpacing: 1, marginLeft: "auto",
          }}>
            UPDATED
          </span>
        )}
      </div>

      <div className="field-help" style={{ margin: "0 0 14px" }}>
        Built for KOL managers — group dozens of accounts by platform, label each one, and pin your top {MAX_PINNED} to feature on your public profile. The rest live behind <strong>SHOW ALL</strong>.
      </div>

      {/* Toolbar: search + add */}
      <div className="lk-toolbar">
        <div className="lk-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            placeholder="search labels, handles, urls..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Platform tabs */}
      <div className="lk-tabs" style={{
        display: "flex",
        gap: 6,
        marginBottom: 14,
        flexWrap: "wrap",
      }}>
        {PLATFORMS.map((p) => (
          <button
            key={p}
            type="button"
            className={`lk-tab${activeTab === p ? " active" : ""}`}
            onClick={() => setActiveTab(p)}
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              fontWeight: activeTab === p ? 700 : 500,
              letterSpacing: 1,
              padding: "7px 12px",
              borderRadius: 4,
              border: `1px solid ${activeTab === p ? "var(--accent)" : "var(--border)"}`,
              background: activeTab === p ? "rgba(255,145,0,.08)" : "transparent",
              color: activeTab === p ? "var(--accent)" : "var(--text-dim)",
              cursor: "pointer",
            }}
          >
            {PLATFORM_LABELS[p]}{" "}
            <span style={{ opacity: 0.6 }}>{counts[p] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Links list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((link) => (
          <div
            key={link.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              background: "var(--bg-input)",
              border: `1px solid ${link.pinned ? "rgba(255,145,0,.35)" : "var(--border)"}`,
              borderRadius: 6,
            }}
          >
            <span style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--text-dim)",
              letterSpacing: 1,
              width: 20,
              textAlign: "center",
              flexShrink: 0,
            }}>
              {link.platform === "tg" ? "T" : link.platform === "x" ? "𝕏" : link.platform === "yt" ? "▶" : "◆"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text)",
                letterSpacing: 0.5,
              }}>
                {link.label}
              </div>
              <div style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                color: "var(--text-dim)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {link.url}
              </div>
            </div>
            <button
              type="button"
              onClick={() => togglePin(link.id)}
              title={link.pinned ? "Unpin" : "Pin to profile"}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1,
                padding: "5px 8px",
                borderRadius: 3,
                border: `1px solid ${link.pinned ? "var(--accent)" : "var(--border)"}`,
                background: link.pinned ? "rgba(255,145,0,.08)" : "transparent",
                color: link.pinned ? "var(--accent)" : "var(--text-dim)",
                cursor: "pointer",
              }}
            >
              {link.pinned ? "PINNED" : "PIN"}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(link.id)}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--text-dim)",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "4px 8px",
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="field-help" style={{ textAlign: "center", padding: "18px 0" }}>
            {search ? "No links match your search." : "No links added yet."}
          </div>
        )}
      </div>

      {/* Add link buttons */}
      {!showAdd ? (
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            type="button"
            className="btn-add-sec"
            onClick={() => setShowAdd(true)}
          >
            + ADD LINK
          </button>
          <button
            type="button"
            className="btn-add-sec"
            onClick={() => setShowBulk(true)}
            style={{ opacity: 0.7 }}
          >
            BULK PASTE
          </button>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginTop: 12,
          padding: 16,
          background: "var(--bg-input)",
          border: "1px dashed var(--border-2)",
          borderRadius: 6,
        }}>
          <div className="id-field">
            <span className="field-key">Label</span>
            <input
              className="field-input"
              placeholder="e.g. My X Account"
              value={addLabel}
              onChange={(e) => setAddLabel(e.target.value)}
            />
          </div>
          <div className="id-field">
            <span className="field-key">URL</span>
            <input
              className="field-input"
              placeholder="https://..."
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
            />
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="btn-cancel" onClick={() => { setAddLabel(""); setAddUrl(""); setShowAdd(false); }}>CANCEL</button>
            <button
              type="button"
              className="btn-add"
              onClick={handleAdd}
              disabled={adding || !addLabel.trim() || !addUrl.trim()}
            >
              {adding ? "ADDING..." : "ADD LINK"}
            </button>
          </div>
        </div>
      )}

      {/* Bulk paste modal */}
      {showBulk && (
        <div className={`lk-bulk open`} onClick={() => !bulkAdding && setShowBulk(false)}>
          <div className="lk-bulk-card" onClick={(e) => e.stopPropagation()}>
            <div className="lk-bulk-head">BULK PASTE LINKS</div>
            <div className="lk-bulk-sub">
              One link per line. Format: <strong>Label — URL</strong> or just paste URLs.
            </div>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"My X Account — https://x.com/handle\nhttps://t.me/mychannel\nYouTube — https://youtube.com/@channel"}
              disabled={bulkAdding}
              autoFocus
            />
            <div className="lk-bulk-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => { setBulkText(""); setShowBulk(false); }}
                disabled={bulkAdding}
              >
                CANCEL
              </button>
              <button
                type="button"
                className="btn-add"
                onClick={handleBulkAdd}
                disabled={bulkAdding || !bulkText.trim()}
              >
                {bulkAdding ? "ADDING..." : "ADD ALL"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
