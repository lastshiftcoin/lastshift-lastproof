"use client";

/**
 * PreviewBanner — shown at the top of a profile when viewed in preview mode.
 * Tells the owner this is a private preview, not the live public view.
 */

export function PreviewBanner({ handle }: { handle: string }) {
  return (
    <div className="pp-preview-banner">
      <div className="pp-preview-inner">
        <span className="pp-preview-badge">PREVIEW MODE</span>
        <span className="pp-preview-text">
          This is a private preview. Only you can see this.
        </span>
        <a
          href={`/profile/${handle}`}
          className="pp-preview-link"
        >
          VIEW PUBLIC →
        </a>
      </div>
    </div>
  );
}
