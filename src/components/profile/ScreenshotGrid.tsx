import type { Screenshot } from "@/lib/public-profile-view";

/**
 * 3-column screenshot grid (collapses to 2 on mobile via CSS).
 * Lightbox interactivity lands later — step 1 renders a static grid.
 */
export function ScreenshotGrid({ screenshots }: { screenshots: Screenshot[] }) {
  return (
    <div className="pp-shots">
      {screenshots.map((s, i) => (
        <div key={s.id} className="pp-shot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.previewUrl} alt={s.caption ?? `Screenshot ${i + 1}`} />
          <div className="pp-shot-label">
            <span>SHOT {i + 1}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
