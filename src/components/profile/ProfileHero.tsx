import type { PublicProfileView } from "@/lib/public-profile-view";

const CHECK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CLOCK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const GLOBE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const COIN_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v12" />
    <path d="M15 9H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H8" />
  </svg>
);

const HIRE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.4 2.1L8.1 9.8a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.4c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.8 2z" />
  </svg>
);

const BADGE_5K_SVG = (
  <svg viewBox="0 0 34 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 2 L32 2 L32 30 L17 38 L2 30 Z" stroke="#ffd700" strokeWidth="1.6" fill="rgba(10,11,15,0.92)" />
    <path d="M5 5 L29 5 L29 28 L17 34.5 L5 28 Z" stroke="rgba(255,215,0,0.4)" strokeWidth="0.8" fill="none" />
  </svg>
);

type Props = Pick<
  PublicProfileView,
  | "handle"
  | "displayName"
  | "avatarUrl"
  | "avatarMonogram"
  | "statusLabel"
  | "isEarlyAdopter"
  | "isVerified"
  | "headline"
  | "timezone"
  | "language"
  | "feeRange"
  | "xHandle"
  | "tgHandle"
  | "website"
  | "hireTelegramHandle"
>;

export function ProfileHero(props: Props) {
  return (
    <section className="pp-hero">
      <div className="pp-avatar-wrap">
        {props.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pp-avatar" src={props.avatarUrl} alt={props.displayName} />
        ) : (
          <div className="pp-avatar pp-avatar-default">{props.avatarMonogram}</div>
        )}
        {props.isEarlyAdopter && (
          <span className="pp-badge-5k" data-tip="First 5000 operator — founding member">
            {BADGE_5K_SVG}
            <span className="pp-num">5K</span>
          </span>
        )}
      </div>

      <div className="pp-id-block">
        <div className="pp-id-name-row">
          <h1 className="pp-id-name">{props.displayName}</h1>
          {props.isVerified && (
            <span className="pp-verified-check" data-tip="X + Telegram linked to the same wallet">
              {CHECK_ICON}
            </span>
          )}
        </div>

        <div className="pp-id-handle-row">
          <div className="pp-id-handle">@{props.handle}</div>
          <span className="pp-status-pill" data-tip="Profile status — active & in good standing">
            <span className="pp-dot" />
            {props.statusLabel}
          </span>
        </div>

        <p className="pp-id-pitch">{props.headline}</p>

        <div className="pp-id-meta">
          <div className="pp-id-meta-item">
            {CLOCK_ICON}
            {props.timezone}
          </div>
          <div className="pp-id-meta-item">
            {GLOBE_ICON}
            {props.language}
          </div>
          <div className="pp-id-meta-item">
            {COIN_ICON}
            <span className="pp-fee">{props.feeRange}</span>
          </div>
        </div>

        <div className="pp-id-links">
          {props.xHandle && (
            <a className="pp-id-link-chip" href={`https://x.com/${props.xHandle}`} target="_blank" rel="noreferrer">
              <span className="pp-key">X</span> @{props.xHandle}
            </a>
          )}
          {props.tgHandle && (
            <a className="pp-id-link-chip" href={`https://t.me/${props.tgHandle}`} target="_blank" rel="noreferrer">
              <span className="pp-key">TG</span> @{props.tgHandle}
            </a>
          )}
          {props.website && (
            <a className="pp-id-link-chip" href={`https://${props.website}`} target="_blank" rel="noreferrer">
              {props.website}
            </a>
          )}
        </div>

        {props.hireTelegramHandle && (
          <div className="pp-id-actions">
            <a
              className="pp-btn-hire"
              href={`https://t.me/${props.hireTelegramHandle}`}
              target="_blank"
              rel="noreferrer"
            >
              {HIRE_ICON}
              HIRE
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
