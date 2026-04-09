import type { ProfileLink } from "@/lib/public-profile-view";

const PLATFORM_ICON: Record<ProfileLink["platform"], React.ReactElement> = {
  tg: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.9 4.2 3.1 11.4c-1.3.5-1.3 1.2-.2 1.5l4.8 1.5 1.9 5.7c.2.6.1 1 .8 1 .5 0 .7-.2 1-.5.2-.2 1.7-1.7 3.4-3.3l4.9 3.6c.9.5 1.6.2 1.8-.8L23 5.6c.4-1.4-.4-2-1.1-1.4zM9.6 14.6l-.5 3.7-1.7-5.2 10.3-6.6-8.1 8.1z" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.9 2H22l-7.5 8.6L23 22h-6.9l-5.4-7-6.2 7H1.4l8-9.2L1 2h7.1l4.9 6.5L18.9 2zm-2.4 18h1.9L7.6 4H5.6l10.9 16z" />
    </svg>
  ),
  web: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  dc: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.4a18.4 18.4 0 0 1 4.5 1.4 17 17 0 0 0-14.4 0A18.4 18.4 0 0 1 9.8 3.4L9.5 3a19.8 19.8 0 0 0-4.8 1.4C1.6 9 .8 13.4 1.2 17.8a19.9 19.9 0 0 0 6.1 3l1.2-1.7a13 13 0 0 1-2-1l.5-.3a14.3 14.3 0 0 0 12 0l.5.4a13 13 0 0 1-2 1l1.2 1.7a19.9 19.9 0 0 0 6.1-3c.5-5.1-.6-9.5-3.5-13.5zM8.7 15.2c-1.2 0-2.1-1.1-2.1-2.4 0-1.4.9-2.5 2.1-2.5 1.2 0 2.2 1.1 2.1 2.5 0 1.3-.9 2.4-2.1 2.4zm6.6 0c-1.2 0-2.1-1.1-2.1-2.4 0-1.4.9-2.5 2.1-2.5 1.2 0 2.2 1.1 2.1 2.5 0 1.3-.9 2.4-2.1 2.4z" />
    </svg>
  ),
};

const PIN_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2 15 9l7 .8-5.3 4.7L18.2 22 12 18l-6.2 4 1.5-7.5L2 9.8 9 9z" />
  </svg>
);

const OPEN_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

/**
 * Pinned-first links list. Step 1 renders all links stacked — the
 * "SHOW ALL" expand toggle and platform filter tabs are decorative only.
 */
export function ProfileLinksList({
  links,
  totalLinks,
  pinnedLinksCount,
}: {
  links: ProfileLink[];
  totalLinks: number;
  pinnedLinksCount: number;
}) {
  const pinned = [...links].filter((l) => l.isPinned).sort((a, b) => a.position - b.position);
  const rest = [...links].filter((l) => !l.isPinned).sort((a, b) => a.position - b.position);
  const ordered = [...pinned, ...rest];

  return (
    <>
      <p className="pp-links-note">
        Operator&apos;s pinned channels and accounts. Pinned items appear first; the rest live behind SHOW ALL.
      </p>
      <div className="pp-lk-tabs">
        <button type="button" className="pp-lk-tab pp-active">
          ALL <span className="pp-ct">{totalLinks}</span>
        </button>
        <button type="button" className="pp-lk-tab">
          PINNED <span className="pp-ct">{pinnedLinksCount}</span>
        </button>
      </div>
      <div className="pp-lk-list">
        {ordered.map((link) => (
          <div
            key={link.id}
            className={`pp-lk-row${link.isPinned ? " pp-pinned" : ""}`}
          >
            <div className={`pp-lk-icon pp-${link.platform}`}>{PLATFORM_ICON[link.platform]}</div>
            <div className="pp-lk-meta">
              <div className="pp-lk-label">{link.label}</div>
              <div className="pp-lk-handle">{link.handle}</div>
            </div>
            {link.isPinned ? (
              <span className="pp-lk-pinned-mark" title="Pinned">
                {PIN_ICON}
              </span>
            ) : (
              <span />
            )}
            <span className="pp-lk-open">{OPEN_ICON}</span>
          </div>
        ))}
        <div className="pp-lk-showall">SHOW ALL {totalLinks} LINKS</div>
      </div>
    </>
  );
}
