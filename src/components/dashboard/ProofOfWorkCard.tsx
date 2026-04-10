"use client";

/**
 * ProofOfWorkCard — work item list with add form, drag reorder, lock logic.
 *
 * Wireframe: lastproof-dashboard.html, PROOF OF WORK section.
 *
 * Layout:
 *   - Info callouts: "LOCKED ON PROOF" + "MINTED PROJECTS"
 *   - Minted subsection (top) — items with minted=true, locked
 *   - Proof of Work subsection — editable items
 *   - "+ ADD PROOF OF WORK" button → inline form
 *   - Each row: grip, ticker, title/role, date range, description, stats, mint button
 *   - Locked items (has proofs) can't be edited/deleted
 *
 * Talks to /api/dashboard/work-items for CRUD.
 */

import { useState, useRef, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorkItem {
  id: string;
  ticker: string | null;
  role: string;
  description: string | null;
  startedAt: string | null; // "YYYY-MM" or null
  endedAt: string | null;   // "YYYY-MM" or null (null = "Present")
  minted: boolean;
  proofCount: number;
  hasDevProof: boolean;
  position: number;
}

interface ProofOfWorkCardProps {
  initialItems: WorkItem[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEARS = ["2026", "2025", "2024", "2023", "2022", "2021", "2020"];

// ─── Component ───────────────────────────────────────────────────────────────

export function ProofOfWorkCard({ initialItems }: ProofOfWorkCardProps) {
  const [items, setItems] = useState<WorkItem[]>(initialItems);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Add form state ─────────────────────────────────────────────────────
  const [formTicker, setFormTicker] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formStartMonth, setFormStartMonth] = useState("");
  const [formStartYear, setFormStartYear] = useState("");
  const [formEndMonth, setFormEndMonth] = useState("");
  const [formEndYear, setFormEndYear] = useState("");
  const [formPresent, setFormPresent] = useState(false);

  // ─── Drag-and-drop state ────────────────────────────────────────────────
  const dragItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const mintedItems = items.filter((i) => i.minted).sort((a, b) => a.position - b.position);
  const regularItems = items.filter((i) => !i.minted).sort((a, b) => a.position - b.position);

  function isLocked(item: WorkItem): boolean {
    return item.proofCount > 0;
  }

  function formatDateRange(item: WorkItem): string {
    const start = item.startedAt
      ? `${MONTHS[parseInt(item.startedAt.split("-")[1], 10) - 1] ?? ""} ${item.startedAt.split("-")[0]}`
      : "";
    if (!item.endedAt) return start ? `${start} — Present` : "Present";
    const end = `${MONTHS[parseInt(item.endedAt.split("-")[1], 10) - 1] ?? ""} ${item.endedAt.split("-")[0]}`;
    return `${start} — ${end}`;
  }

  // ─── Add handler ────────────────────────────────────────────────────────
  async function handleAdd() {
    if (!formRole.trim()) return;
    setSaving(true);

    const startedAt = formStartMonth && formStartYear
      ? `${formStartYear}-${String(MONTHS.indexOf(formStartMonth) + 1).padStart(2, "0")}`
      : null;
    const endedAt = formPresent ? null
      : formEndMonth && formEndYear
        ? `${formEndYear}-${String(MONTHS.indexOf(formEndMonth) + 1).padStart(2, "0")}`
        : null;

    try {
      const res = await fetch("/api/dashboard/work-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: formTicker.trim() || null,
          role: formRole.trim(),
          description: formDesc.trim() || null,
          startedAt,
          endedAt,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to add");
        return;
      }

      const { item } = await res.json();
      setItems((prev) => [...prev, item]);
      resetForm();
      setShowForm(false);
    } catch {
      alert("Failed to add — please try again.");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setFormTicker("");
    setFormRole("");
    setFormDesc("");
    setFormStartMonth("");
    setFormStartYear("");
    setFormEndMonth("");
    setFormEndYear("");
    setFormPresent(false);
  }

  // ─── Edit handler ────────────────────────────────────────────────────────
  async function handleEdit(id: string, fields: {
    ticker: string | null; role: string; description: string | null;
    startedAt: string | null; endedAt: string | null;
  }): Promise<boolean> {
    try {
      const res = await fetch("/api/dashboard/work-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...fields }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "locked_has_proofs") {
          alert("This work item has proofs and can no longer be edited.");
        } else {
          alert(data.error || "Edit failed");
        }
        return false;
      }

      const { item } = await res.json();
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...item } : i));
      return true;
    } catch {
      alert("Edit failed — please try again.");
      return false;
    }
  }

  // ─── Delete handler ─────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm("Delete this work item?")) return;

    try {
      const res = await fetch(`/api/dashboard/work-items?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.error === "locked_has_proofs") {
          alert("This work item has proofs and can no longer be deleted.");
        } else {
          alert(data.error || "Delete failed");
        }
      }
    } catch {
      alert("Delete failed.");
    }
  }

  // ─── Mint state + handler ────────────────────────────────────────────────
  const [mintingId, setMintingId] = useState<string | null>(null);
  const [mintQuote, setMintQuote] = useState<{
    token: string; amountToken: string; amountUsd: number;
    treasury: string; reference: string; expiresAt: string;
  } | null>(null);

  async function handleMint(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item || item.minted) return;

    if (item.proofCount === 0) {
      alert("This work item needs at least 1 proof before it can be minted.");
      return;
    }

    const mintedCount = items.filter((i) => i.minted).length;
    if (mintedCount >= 4) {
      alert("Maximum 4 minted projects. Unmint one first.");
      return;
    }

    // Show inline payment panel for this item
    setMintingId(id);
    setMintQuote(null);
  }

  async function requestMintQuote(token: "LASTSHFT" | "SOL" | "USDT") {
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "mint", token, metadata: { workItemId: mintingId } }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.reason || data.error || "Quote failed");
        return;
      }
      const data = await res.json();
      setMintQuote({
        token: data.token,
        amountToken: data.amountToken,
        amountUsd: data.amountUsd,
        treasury: data.treasury,
        reference: data.reference,
        expiresAt: data.expiresAt,
      });
    } catch {
      alert("Failed to get quote.");
    }
  }

  async function confirmMint(txSignature: string) {
    if (!mintingId) return;
    try {
      const res = await fetch("/api/dashboard/work-items/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: mintingId, txSignature }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "no_proofs") {
          alert("This work item needs at least 1 proof before minting.");
        } else if (data.error === "max_minted") {
          alert("Maximum 4 minted projects reached.");
        } else if (data.error === "already_minted") {
          alert("Already minted.");
        } else {
          alert(data.error || "Mint failed");
        }
        return;
      }

      setItems((prev) => prev.map((i) =>
        i.id === mintingId ? { ...i, minted: true } : i
      ));
      setMintingId(null);
      setMintQuote(null);
    } catch {
      alert("Mint failed — please try again.");
    }
  }

  // ─── Drag handlers ──────────────────────────────────────────────────────
  const handleDragStart = useCallback((id: string) => {
    dragItem.current = id;
    setDragId(id);
  }, []);

  const handleDragEnter = useCallback((id: string) => {
    dragOverItem.current = id;
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!dragItem.current || !dragOverItem.current || dragItem.current === dragOverItem.current) {
      setDragId(null);
      return;
    }

    setItems((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((i) => i.id === dragItem.current);
      const toIdx = arr.findIndex((i) => i.id === dragOverItem.current);
      if (fromIdx === -1 || toIdx === -1) return prev;

      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      // Reassign positions
      return arr.map((item, i) => ({ ...item, position: i }));
    });

    dragItem.current = null;
    dragOverItem.current = null;
    setDragId(null);
  }, []);

  // ─── Save order ─────────────────────────────────────────────────────────
  async function handleSaveOrder() {
    setSaving(true);
    setSaved(false);
    if (savedTimer.current) clearTimeout(savedTimer.current);

    try {
      const ids = [...mintedItems, ...regularItems].map((item) => item.id);

      const res = await fetch("/api/dashboard/work-items/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Reorder failed");
        return;
      }

      setSaved(true);
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
    } catch {
      alert("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="edit-card" id="powCard">
      <div className="edit-head">
        <div className="edit-title">PROOF OF WORK</div>
        <button
          type="button"
          className={`edit-action${saved ? " saved" : ""}`}
          onClick={handleSaveOrder}
          disabled={saving}
        >
          {saving ? "SAVING..." : saved ? "SAVED ✓" : "SAVE →"}
        </button>
      </div>

      <div className="field-help" style={{ margin: "0 0 12px" }}>
        List as many projects as you want. Only your last 5 show on your public profile — visitors can hit <strong>SEE MORE</strong> to expand the rest. Drag to reorder.
      </div>

      {/* Callout boxes */}
      <div className="pow-callout">
        <div className="pow-cal lock">
          <div className="pow-cal-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="1.5" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </div>
          <div className="pow-cal-body">
            <div className="pow-cal-head">LOCKED ON PROOF</div>
            <div className="pow-cal-text">Once a project receives proofs, it can no longer be edited or deleted — that&apos;s what makes them count.</div>
          </div>
        </div>
        <div className="pow-cal gold">
          <div className="pow-cal-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 15 9l7 .8-5.3 4.7L18.2 22 12 18l-6.2 4 1.5-7.5L2 9.8 9 9z" />
            </svg>
          </div>
          <div className="pow-cal-body">
            <div className="pow-cal-head">MINTED PROJECTS</div>
            <div className="pow-cal-text">Your best work — featured first on your profile with a visible standout.</div>
          </div>
        </div>
      </div>

      {/* Minted subsection */}
      <div className="minted-head" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
        <div className="minted-title">
          Minted Projects{" "}
          <span style={{ color: "var(--text-dim)", fontWeight: 400, marginLeft: 6 }}>
            {mintedItems.length} / 4
          </span>
        </div>
        <span className="status-note" style={{ color: "var(--text-dim)" }}>DRAG TO REORDER · MAX 4</span>
      </div>

      {mintedItems.length > 0 ? (
        <div className="pow-list">
          {mintedItems.map((item) => (
            <PowRow key={item.id} item={item} locked onEdit={handleEdit} onDelete={handleDelete} onMint={handleMint} formatDate={formatDateRange}
              isDragging={dragId === item.id} onDragStart={handleDragStart} onDragEnter={handleDragEnter} onDragEnd={handleDragEnd} />
          ))}
        </div>
      ) : (
        <div className="minted-empty">
          <div className="me-head">— EMPTY —</div>
          <div className="me-sub"><strong>Mint a Project</strong> from your Proof of Work below to lock it on-chain as permanent, tamper-proof history.</div>
        </div>
      )}

      {/* Regular PoW subsection */}
      <div className="minted-head" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="minted-title" style={{ color: "var(--accent)" }}>Proof of Work</div>
        <span className="status-note" style={{ color: "var(--text-dim)" }}>DRAG TO REORDER</span>
      </div>

      {regularItems.length > 0 ? (
        <div className="pow-list">
          {regularItems.map((item) => (
            <PowRow
              key={item.id}
              item={item}
              locked={isLocked(item)}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onMint={handleMint}
              formatDate={formatDateRange}
              isDragging={dragId === item.id}
              onDragStart={handleDragStart}
              onDragEnter={handleDragEnter}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      ) : (
        <div className="field-help" style={{ textAlign: "center", padding: "18px 0" }}>
          No work items yet. Add your first proof of work below.
        </div>
      )}

      {/* Mint payment panel */}
      {mintingId && (
        <div style={{
          margin: "12px 0",
          padding: 18,
          background: "var(--bg-input)",
          border: "1px solid rgba(255,215,0,.3)",
          borderRadius: 8,
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}>
            <div style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              color: "var(--text)",
            }}>
              MINT PROJECT
            </div>
            <button
              type="button"
              onClick={() => { setMintingId(null); setMintQuote(null); }}
              style={{
                fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)",
                background: "transparent", border: "1px solid var(--border)",
                borderRadius: 4, padding: "4px 10px", cursor: "pointer",
              }}
            >
              CANCEL
            </button>
          </div>

          <div className="field-help" style={{ marginBottom: 14 }}>
            Minting costs <strong>$1.00</strong> (or <strong>$0.60</strong> with $LASTSHFT — 40% off).
            Once minted, this project is locked as permanent, tamper-proof history.
          </div>

          {!mintQuote ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn-add"
                style={{ background: "rgba(255,145,0,.1)", color: "var(--accent)", border: "1px solid var(--accent)" }}
                onClick={() => requestMintQuote("LASTSHFT")}
              >
                PAY WITH $LASTSHFT · $0.60
              </button>
              <button type="button" className="btn-add" onClick={() => requestMintQuote("SOL")}>
                PAY WITH SOL · $1.00
              </button>
              <button type="button" className="btn-add" onClick={() => requestMintQuote("USDT")}>
                PAY WITH USDT · $1.00
              </button>
            </div>
          ) : (
            <div style={{
              padding: 14, background: "rgba(0,0,0,.2)",
              border: "1px solid var(--border)", borderRadius: 6,
              fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-2)",
              letterSpacing: 0.5,
            }}>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: "#fff" }}>Send exactly:</strong>{" "}
                <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                  {mintQuote.amountToken} {mintQuote.token}
                </span>{" "}
                <span style={{ color: "var(--text-dim)" }}>(${mintQuote.amountUsd})</span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: "#fff" }}>To treasury:</strong>{" "}
                <span style={{ wordBreak: "break-all" }}>{mintQuote.treasury}</span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: "#fff" }}>Reference:</strong>{" "}
                <span style={{ wordBreak: "break-all" }}>{mintQuote.reference}</span>
              </div>
              <div style={{ color: "var(--text-dim)", marginBottom: 10 }}>
                Quote expires: {new Date(mintQuote.expiresAt).toLocaleTimeString()}
              </div>
              <div className="field-help">
                Send the exact amount with the reference memo. After confirmation, enter your tx signature below.
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
                <input
                  id="mintTxInput"
                  className="field-input"
                  style={{ flex: 1, fontSize: 10 }}
                  placeholder="Paste transaction signature..."
                />
                <button
                  type="button"
                  className="btn-add"
                  onClick={() => {
                    const input = document.getElementById("mintTxInput") as HTMLInputElement;
                    if (input?.value.trim()) confirmMint(input.value.trim());
                  }}
                >
                  CONFIRM MINT
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add button / form */}
      {!showForm ? (
        <button
          type="button"
          className="btn-add-sec"
          style={{ marginTop: 12 }}
          onClick={() => setShowForm(true)}
        >
          + ADD PROOF OF WORK
        </button>
      ) : (
        <div className="pow-add-form" style={{ marginTop: 12 }}>
          <div className="id-field full">
            <span className="field-key">Ticker / Token Symbol</span>
            <input
              className="field-input"
              placeholder="e.g. $BONK, $WIF"
              value={formTicker}
              onChange={(e) => setFormTicker(e.target.value)}
            />
          </div>
          <div className="id-field full">
            <span className="field-key">Title / Role</span>
            <input
              className="field-input"
              placeholder="e.g. Launch Ops Lead"
              value={formRole}
              onChange={(e) => setFormRole(e.target.value)}
            />
          </div>
          <div className="id-field full">
            <span className="field-key">Job Description · {formDesc.length} / 240 chars</span>
            <textarea
              className="field-input"
              maxLength={240}
              rows={2}
              placeholder="what you owned, what you shipped, what moved"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value.slice(0, 240))}
            />
          </div>
          <div className="id-field full">
            <span className="field-key">Date Range</span>
            <div className="date-range-grid">
              <div className="dr-group">
                <div className="dr-label">START</div>
                <div className="dr-row">
                  <select className="field-input" value={formStartMonth} onChange={(e) => setFormStartMonth(e.target.value)}>
                    <option value="">Month</option>
                    {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select className="field-input" value={formStartYear} onChange={(e) => setFormStartYear(e.target.value)}>
                    <option value="">Year</option>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div className="dr-sep">—</div>
              <div className="dr-group">
                <div className="dr-label">END</div>
                <div className="dr-row">
                  <select
                    className="field-input"
                    value={formEndMonth}
                    onChange={(e) => setFormEndMonth(e.target.value)}
                    disabled={formPresent}
                  >
                    <option value="">Month</option>
                    {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select
                    className="field-input"
                    value={formEndYear}
                    onChange={(e) => setFormEndYear(e.target.value)}
                    disabled={formPresent}
                  >
                    <option value="">Year</option>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <label className="present-toggle">
                  <input
                    type="checkbox"
                    checked={formPresent}
                    onChange={(e) => setFormPresent(e.target.checked)}
                  />
                  {" "}Present <span style={{ color: "var(--text-dim)" }}>· marks this as Current</span>
                </label>
              </div>
            </div>
          </div>
          <div className="pow-form-actions">
            <button type="button" className="btn-cancel" onClick={() => { resetForm(); setShowForm(false); }}>CANCEL</button>
            <button
              type="button"
              className="btn-add"
              onClick={handleAdd}
              disabled={saving || !formRole.trim()}
            >
              {saving ? "ADDING..." : "ADD PROOF"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PowRow sub-component ────────────────────────────────────────────────────

function PowRow({
  item,
  locked,
  onEdit,
  onDelete,
  onMint,
  formatDate,
  isDragging,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  item: WorkItem;
  locked: boolean;
  onEdit: (id: string, fields: {
    ticker: string | null; role: string; description: string | null;
    startedAt: string | null; endedAt: string | null;
  }) => Promise<boolean>;
  onDelete: (id: string) => void;
  onMint: (id: string) => void;
  formatDate: (item: WorkItem) => string;
  isDragging: boolean;
  onDragStart: (id: string) => void;
  onDragEnter: (id: string) => void;
  onDragEnd: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // Edit form state
  const [eTicker, setETicker] = useState(item.ticker ?? "");
  const [eRole, setERole] = useState(item.role);
  const [eDesc, setEDesc] = useState(item.description ?? "");
  const [eStartMonth, setEStartMonth] = useState(() => {
    if (!item.startedAt) return "";
    const m = parseInt(item.startedAt.split("-")[1], 10);
    return MONTHS[m - 1] ?? "";
  });
  const [eStartYear, setEStartYear] = useState(() => item.startedAt?.split("-")[0] ?? "");
  const [eEndMonth, setEEndMonth] = useState(() => {
    if (!item.endedAt) return "";
    const m = parseInt(item.endedAt.split("-")[1], 10);
    return MONTHS[m - 1] ?? "";
  });
  const [eEndYear, setEEndYear] = useState(() => item.endedAt?.split("-")[0] ?? "");
  const [ePresent, setEPresent] = useState(!item.endedAt);

  const isCurrent = !item.endedAt;

  function startEdit() {
    setETicker(item.ticker ?? "");
    setERole(item.role);
    setEDesc(item.description ?? "");
    if (item.startedAt) {
      const [y, m] = item.startedAt.split("-");
      setEStartYear(y);
      setEStartMonth(MONTHS[parseInt(m, 10) - 1] ?? "");
    } else {
      setEStartYear(""); setEStartMonth("");
    }
    if (item.endedAt) {
      const [y, m] = item.endedAt.split("-");
      setEEndYear(y);
      setEEndMonth(MONTHS[parseInt(m, 10) - 1] ?? "");
      setEPresent(false);
    } else {
      setEEndYear(""); setEEndMonth("");
      setEPresent(true);
    }
    setEditing(true);
  }

  async function saveEdit() {
    if (!eRole.trim()) return;
    setEditSaving(true);

    const startedAt = eStartMonth && eStartYear
      ? `${eStartYear}-${String(MONTHS.indexOf(eStartMonth) + 1).padStart(2, "0")}`
      : null;
    const endedAt = ePresent ? null
      : eEndMonth && eEndYear
        ? `${eEndYear}-${String(MONTHS.indexOf(eEndMonth) + 1).padStart(2, "0")}`
        : null;

    const ok = await onEdit(item.id, {
      ticker: eTicker.trim() || null,
      role: eRole.trim(),
      description: eDesc.trim() || null,
      startedAt,
      endedAt,
    });

    setEditSaving(false);
    if (ok) setEditing(false);
  }

  // ─── Edit mode ──────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className={`pow-row${item.minted ? " minted" : ""}`} style={{ background: "rgba(255,145,0,.04)" }}>
        <div className="pow-add-form" style={{ margin: 0, border: "none", padding: "12px 0", background: "transparent" }}>
          <div className="id-field full">
            <span className="field-key">Ticker / Token Symbol</span>
            <input className="field-input" placeholder="e.g. $BONK, $WIF" value={eTicker} onChange={(e) => setETicker(e.target.value)} />
          </div>
          <div className="id-field full">
            <span className="field-key">Title / Role</span>
            <input className="field-input" placeholder="e.g. Launch Ops Lead" value={eRole} onChange={(e) => setERole(e.target.value)} />
          </div>
          <div className="id-field full">
            <span className="field-key">Job Description · {eDesc.length} / 240 chars</span>
            <textarea className="field-input" maxLength={240} rows={2} placeholder="what you owned, what you shipped, what moved" value={eDesc} onChange={(e) => setEDesc(e.target.value.slice(0, 240))} />
          </div>
          <div className="id-field full">
            <span className="field-key">Date Range</span>
            <div className="date-range-grid">
              <div className="dr-group">
                <div className="dr-label">START</div>
                <div className="dr-row">
                  <select className="field-input" value={eStartMonth} onChange={(e) => setEStartMonth(e.target.value)}>
                    <option value="">Month</option>
                    {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select className="field-input" value={eStartYear} onChange={(e) => setEStartYear(e.target.value)}>
                    <option value="">Year</option>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div className="dr-sep">—</div>
              <div className="dr-group">
                <div className="dr-label">END</div>
                <div className="dr-row">
                  <select className="field-input" value={eEndMonth} onChange={(e) => setEEndMonth(e.target.value)} disabled={ePresent}>
                    <option value="">Month</option>
                    {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select className="field-input" value={eEndYear} onChange={(e) => setEEndYear(e.target.value)} disabled={ePresent}>
                    <option value="">Year</option>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <label className="present-toggle">
                  <input type="checkbox" checked={ePresent} onChange={(e) => setEPresent(e.target.checked)} />
                  {" "}Present <span style={{ color: "var(--text-dim)" }}>· marks this as Current</span>
                </label>
              </div>
            </div>
          </div>
          <div className="pow-form-actions">
            <button type="button" className="btn-cancel" onClick={() => setEditing(false)}>CANCEL</button>
            <button type="button" className="btn-add" onClick={saveEdit} disabled={editSaving || !eRole.trim()}>
              {editSaving ? "SAVING..." : "SAVE CHANGES"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── View mode ──────────────────────────────────────────────────────────
  return (
    <div
      className={`pow-row${item.minted ? " minted" : ""}`}
      draggable
      onDragStart={() => onDragStart(item.id)}
      onDragEnter={() => onDragEnter(item.id)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      style={{ opacity: isDragging ? 0.4 : 1, cursor: "grab" }}
    >
      <div className="pow-top">
        <span className="pow-grip" style={{ cursor: "grab" }}>{"\u22EE\u22EE"}</span>
        <span className="pow-tick">{item.ticker || "—"}</span>
        <div className="pow-meta">
          <div className="pow-title">
            {item.role}
            {isCurrent && <span className="pow-badge cur">CURRENT</span>}
          </div>
          <div className="pow-when">{formatDate(item)}</div>
          {item.description && <div className="pow-desc">{item.description}</div>}
        </div>
        {locked ? (
          <span className="pow-locked-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="1.5" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            LOCKED
          </span>
        ) : (
          <>
            <button type="button" className="pow-edit" onClick={startEdit}>EDIT</button>
            <button type="button" className="pow-trash" title="Delete" onClick={() => onDelete(item.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" />
              </svg>
            </button>
          </>
        )}
      </div>
      <div className="pow-stats">
        <div className="pow-stat"><span className="num">{item.proofCount}</span> PROOFS</div>
        {item.hasDevProof && <div className="pow-stat"><span className="pow-badge dev">DEV</span></div>}
        <button
          type="button"
          className={`pow-mintbtn${item.minted ? " minted" : ""}`}
          onClick={() => { if (!item.minted) onMint(item.id); }}
        >
          {item.minted ? "✓ MINTED" : "MINT THIS PROJECT"}
        </button>
      </div>
    </div>
  );
}
