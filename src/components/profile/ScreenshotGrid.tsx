"use client";

import { useState } from "react";
import type { Screenshot } from "@/lib/public-profile-view";

/**
 * 3-column screenshot grid (collapses to 2 on mobile via CSS).
 * Click any thumbnail to open a full-size lightbox gallery.
 */
export function ScreenshotGrid({ screenshots }: { screenshots: Screenshot[] }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  return (
    <>
      <div className="pp-shots">
        {screenshots.map((s, i) => (
          <div
            key={s.id}
            className="pp-shot"
            onClick={() => setLightboxIdx(i)}
            style={{ cursor: "pointer" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.previewUrl} alt={s.caption ?? `Screenshot ${i + 1}`} />
            <div className="pp-shot-label">
              <span>SHOT {i + 1}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && screenshots[lightboxIdx] && (
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
            {screenshots.length > 1 && (
              <button
                type="button"
                className="shot-lb-nav prev"
                onClick={() => setLightboxIdx((lightboxIdx - 1 + screenshots.length) % screenshots.length)}
              >
                &lsaquo;
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshots[lightboxIdx].imageUrl}
              alt={screenshots[lightboxIdx].caption ?? `Screenshot ${lightboxIdx + 1}`}
              className="shot-lb-img"
            />
            {screenshots.length > 1 && (
              <button
                type="button"
                className="shot-lb-nav next"
                onClick={() => setLightboxIdx((lightboxIdx + 1) % screenshots.length)}
              >
                &rsaquo;
              </button>
            )}
            <div className="shot-lb-counter">
              {lightboxIdx + 1} / {screenshots.length}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
