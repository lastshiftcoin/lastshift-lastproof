"use client";

/**
 * Live price ticker for the step 6 review card.
 *
 * Polls POST /api/proof/quote/:id/refresh every 5 seconds while the
 * review card is mounted. Backend returns the same quote_id with an
 * updated `amount_ui`, `amount_raw`, `usd_rate`, `expires_at`. At
 * ≥45s stale the backend silently re-verifies eligibility inline
 * (reply Q16b) — the FE doesn't need to do anything special for
 * soft refresh; it's just another poll that happens to carry fresh
 * numbers.
 *
 * Failure branches (reply §6 + §8):
 *   - `{ok: true}` → swap in the new quote fields (soft path)
 *   - `{ok: false, reason: "quote_expired_hard"}` → expose `.expired`
 *   - `{ok: false, reason: "slot_taken"}` → expose `.slotTaken`
 *   - `{ok: false, reason: "lock_lost"}` → expose `.lockLost` (409)
 *   - network / 5xx → `.error` with message, next poll retries
 *
 * The hook does NOT drive UI state transitions itself — it just
 * exposes the latest snapshot. The caller (ProofModal) reacts to
 * `.expired / .slotTaken / .lockLost` flags and drives the step
 * machine.
 *
 * During local dev this points at /api/mock/proof/quote/:id/refresh.
 * When the real endpoint lands, swap the URL — payload shape is
 * identical per backend contract.
 */

import { useEffect, useRef, useState } from "react";
import type { ProofQuote } from "./types";

const POLL_MS = 5000;

export interface RefreshState {
  /** Latest quote — starts as whatever was passed in via `initialQuote`. */
  quote: ProofQuote;
  /** Server re-verification flag (reply §6). Only set when poll returns ok. */
  reVerified: boolean;
  /** Hard-expired state — card should swap to the refresh-price banner. */
  expired: boolean;
  /** Dev slot was taken by someone else between eligibility and now. */
  slotTaken: boolean;
  /** 409 lock lost — user needs to restart from step 1. */
  lockLost: boolean;
  /** Transient network/5xx error — recovers on next poll. */
  error: string | null;
  /** ISO timestamp of the most recent successful poll. */
  lastPollAt: string | null;
}

export interface UseQuoteRefreshArgs {
  initialQuote: ProofQuote;
  /** Turn polling off (e.g. user navigated away from step 6). */
  enabled: boolean;
}

export function useQuoteRefresh({ initialQuote, enabled }: UseQuoteRefreshArgs) {
  const [state, setState] = useState<RefreshState>({
    quote: initialQuote,
    reVerified: false,
    expired: false,
    slotTaken: false,
    lockLost: false,
    error: null,
    lastPollAt: null,
  });

  // Pin the latest initial quote in a ref so a parent re-render with a
  // fresh quote (e.g. user navigated back and re-ran eligibility)
  // reseeds the state without retriggering the poll loop.
  const seededRef = useRef<string>(initialQuote.quote_id);
  useEffect(() => {
    if (seededRef.current !== initialQuote.quote_id) {
      seededRef.current = initialQuote.quote_id;
      setState({
        quote: initialQuote,
        reVerified: false,
        expired: false,
        slotTaken: false,
        lockLost: false,
        error: null,
        lastPollAt: null,
      });
    }
  }, [initialQuote]);

  const refresh = useRef(async (quoteId: string, signal: AbortSignal) => {
    try {
      const res = await fetch(`/api/mock/proof/quote/${quoteId}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ scenario: "ok" }),
        signal,
      });

      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { reason?: string };
        setState((s) => ({ ...s, lockLost: true, error: body.reason ?? "lock_lost" }));
        return;
      }

      if (!res.ok) {
        setState((s) => ({ ...s, error: `refresh ${res.status}` }));
        return;
      }

      const body = (await res.json()) as {
        ok: boolean;
        reason?: string;
        quote?: ProofQuote;
        eligibility?: { reVerified: boolean; ageMs: number };
      };

      if (!body.ok) {
        if (body.reason === "quote_expired_hard") {
          setState((s) => ({ ...s, expired: true, error: null }));
        } else if (body.reason === "slot_taken") {
          setState((s) => ({ ...s, slotTaken: true, error: null }));
        } else {
          setState((s) => ({ ...s, error: body.reason ?? "refresh failed" }));
        }
        return;
      }

      if (!body.quote) return;
      setState((s) => ({
        ...s,
        quote: {
          // Preserve token from the originally-selected quote — the
          // mock currently always echoes "lastshft" regardless of
          // the picked token. Real endpoint will echo correctly.
          ...body.quote!,
          token: s.quote.token,
        },
        reVerified: body.eligibility?.reVerified ?? false,
        error: null,
        lastPollAt: new Date().toISOString(),
      }));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState((s) => ({ ...s, error: (err as Error).message }));
    }
  });

  // Poll loop
  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    const tick = () => {
      refresh.current(state.quote.quote_id, ctrl.signal);
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      window.clearInterval(id);
      ctrl.abort();
    };
    // We intentionally key the poll loop on quote_id — NOT on the
    // whole `state.quote` — so a price drift inside the poll
    // callback doesn't tear down and restart the interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, state.quote.quote_id]);

  // Manual refresh (used by the "REFRESH PRICE" CTA on the hard-
  // expired banner). Clears the expired flag on a successful poll.
  const manualRefresh = useRef(async () => {
    setState((s) => ({ ...s, expired: false, error: null }));
    const ctrl = new AbortController();
    await refresh.current(state.quote.quote_id, ctrl.signal);
  });

  return { state, manualRefresh: manualRefresh.current };
}
