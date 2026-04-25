/**
 * ChadArmyStrip — public profile section between TrustTierBar and
 * ProfileTabs. Up to 10 avatars with a SEE ARMY pill that floats right.
 *
 * Hides entirely when the operator has zero accepted chads (per locked
 * design — no zero-state on the public profile).
 *
 * Server component — composed by the public profile page after fetching
 * the first page of accepted chads. Avatar order is randomized per
 * request inside this component (the underlying fetch is cached by
 * profile, the shuffle is render-time so cache stays warm).
 */

import Link from "next/link";
import type { ChadProfileSummary } from "@/lib/chads/profile-batch";
import { ChadAvatar, initialsForHandle } from "./ChadAvatar";

interface Props {
  handle: string;
  chads: ChadProfileSummary[];
  /** Total accepted chad count; controls whether SEE ARMY shows ("Total > 10"). */
  armyCount: number;
}

/** In-render shuffle so avatar order varies per request without invalidating
 *  upstream caches that key on the profile data. Fisher-Yates on a copy. */
function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function ChadArmyStrip({ handle, chads, armyCount }: Props) {
  if (armyCount === 0 || chads.length === 0) return null;

  const display = shuffle(chads).slice(0, 10);

  return (
    <section className="chad-army-strip">
      <h2 className="section-title">CHAD ARMY</h2>
      <div className="chad-army-row">
        <div className="chad-army-avatars">
          {display.map((c) => (
            <Link key={c.wallet} href={`/@${c.handle}`} className="chad-army-link" aria-label={`@${c.handle}`}>
              <ChadAvatar
                avatarUrl={c.avatarUrl}
                initials={initialsForHandle(c.displayName || c.handle)}
                handle={c.handle}
                size={54}
              />
            </Link>
          ))}
        </div>
        {armyCount > 10 && (
          <Link href={`/@${handle}/chads`} className="chad-see-army">
            SEE ARMY
          </Link>
        )}
      </div>
    </section>
  );
}
