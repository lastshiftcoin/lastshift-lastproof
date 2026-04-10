"use client";

/**
 * ScreenshotsCard — screenshot gallery with upload, delete, and URL attach.
 *
 * Wireframe: lastproof-dashboard.html, SCREENSHOTS section.
 *
 * - 4-column grid, up to 8 screenshots
 * - Upload: click empty slot → file picker → upload to Supabase Storage
 * - Each shot: number badge, optional URL flag, delete button
 * - Empty slots shown as dashed placeholders
 *
 * Talks to /api/dashboard/screenshots for CRUD.
 */

import { useState, useRef } from "react";

interface Screenshot {
  id: string;
  imageUrl: string;
  linkedUrl: string | null;
  position: number;
}

interface ScreenshotsCardProps {
  initialShots: Screenshot[];
}

const MAX_SHOTS = 8;

export function ScreenshotsCard({ initialShots }: ScreenshotsCardProps) {
  const [shots, setShots] = useState<Screenshot[]>(initialShots.sort((a, b) => a.position - b.position));
  const [uploading, setUploading] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ─── Upload handler ─────────────────────────────────────────────────────
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      alert("Only PNG, JPEG, or WebP files are allowed.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("File must be under 2MB.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("position", String(shots.length));

    try {
      const res = await fetch("/api/dashboard/screenshots", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Upload failed");
        return;
      }

      const { screenshot } = await res.json();
      setShots((prev) => [...prev, screenshot]);
    } catch {
      alert("Upload failed — please try again.");
    } finally {
      setUploading(false);
      // Reset file input
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ─── Delete handler ─────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm("Delete this screenshot?")) return;

    try {
      const res = await fetch(`/api/dashboard/screenshots?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setShots((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      alert("Delete failed.");
    }
  }

  // No ghost placeholder slots — grid expands naturally as shots are added

  return (
    <div className="edit-card">
      <div className="edit-head">
        <div className="edit-title">SCREENSHOTS</div>
      </div>

      <div className="field-help" style={{ margin: "0 0 14px" }}>
        Campaign analytics, raid screenshots, proof imagery — clicked thumbnails open a full-size lightbox gallery on your public profile. Drag to reorder. Optionally attach a URL to any shot.
      </div>

      <div className="shot-meta">
        <div className="count"><strong>{shots.length}</strong> / {MAX_SHOTS} UPLOADED</div>
        <div className="rules">JPG · PNG · 2 MB MAX · ANY DIMENSIONS</div>
      </div>

      <div className="shot-grid">
        {/* Existing screenshots */}
        {shots.map((shot, i) => (
          <div key={shot.id} className="shot">
            <div className="shot-num">{String(i + 1).padStart(2, "0")}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shot.imageUrl}
              alt={`Screenshot ${i + 1}`}
              onClick={() => setLightboxIdx(i)}
              style={{ cursor: "pointer" }}
            />
            {shot.linkedUrl && (
              <div className="shot-link-flag">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1 1" />
                  <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1-1" />
                </svg>
              </div>
            )}
            <div className="shot-actions">
              <button
                type="button"
                className={`shot-act${shot.linkedUrl ? " has-url" : ""}`}
                title={shot.linkedUrl ? "URL attached — click to edit" : "Attach URL"}
                onClick={async () => {
                  const url = prompt("Enter URL to attach to this screenshot:", shot.linkedUrl ?? "");
                  if (url === null) return;
                  // Optimistic update
                  const prev = shot.linkedUrl;
                  setShots((s) => s.map((x) =>
                    x.id === shot.id ? { ...x, linkedUrl: url || null } : x
                  ));
                  try {
                    const res = await fetch("/api/dashboard/screenshots", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: shot.id, linkedUrl: url || null }),
                    });
                    if (!res.ok) {
                      setShots((s) => s.map((x) =>
                        x.id === shot.id ? { ...x, linkedUrl: prev } : x
                      ));
                    }
                  } catch {
                    setShots((s) => s.map((x) =>
                      x.id === shot.id ? { ...x, linkedUrl: prev } : x
                    ));
                  }
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1 1" />
                  <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1-1" />
                </svg>
              </button>
              <button
                type="button"
                className="shot-act del"
                title="Delete"
                onClick={() => handleDelete(shot.id)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
              </button>
            </div>
          </div>
        ))}

        {/* Empty upload slot (only one clickable) */}
        {shots.length < MAX_SHOTS && (
          <div
            className="shot empty"
            onClick={() => fileRef.current?.click()}
          >
            <div className="plus">{uploading ? "..." : "+"}</div>
            <div className="lbl">{uploading ? "UPLOADING" : "UPLOAD"}</div>
          </div>
        )}

        {/* Grid expands as screenshots are added — no ghost placeholders */}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={handleUpload}
      />

      {/* Lightbox */}
      {lightboxIdx !== null && shots[lightboxIdx] && (
        <div
          className="shot-lightbox"
          onClick={() => setLightboxIdx(null)}
        >
          <div className="shot-lb-inner" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="shot-lb-close"
              onClick={() => setLightboxIdx(null)}
            >
              &times;
            </button>
            {shots.length > 1 && (
              <button
                type="button"
                className="shot-lb-nav prev"
                onClick={() => setLightboxIdx((lightboxIdx - 1 + shots.length) % shots.length)}
              >
                &lsaquo;
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shots[lightboxIdx].imageUrl}
              alt={`Screenshot ${lightboxIdx + 1}`}
              className="shot-lb-img"
            />
            {shots.length > 1 && (
              <button
                type="button"
                className="shot-lb-nav next"
                onClick={() => setLightboxIdx((lightboxIdx + 1) % shots.length)}
              >
                &rsaquo;
              </button>
            )}
            <div className="shot-lb-counter">
              {lightboxIdx + 1} / {shots.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
