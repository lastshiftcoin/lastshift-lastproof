"use client";

import { useCallback, useRef, useState } from "react";
import type { EligibilityState, ProofPath } from "./types";
import type { ProofTokenKey } from "@/lib/proof-tokens";

/**
 * SSE client for POST /api/proof/eligibility.
 *
 * Default transport is text/event-stream per reply §5. We use fetch +
 * manual stream parsing instead of EventSource because EventSource is
 * GET-only and the real endpoint is POST.
 *
 * During local dev this points at /api/mock/proof/eligibility (backend
 * shipped it at d8ff3a6). When the real endpoint lands, swap the URL —
 * the event schema is identical.
 */

const ELIGIBILITY_URL = "/api/proof/eligibility";

const INITIAL: EligibilityState = {
  status: "idle",
  checks: [],
  eligible: null,
  quote: null,
  failedChecks: [],
  error: null,
};

export interface StartEligibilityArgs {
  path: ProofPath;
  /**
   * Token input — eligibility's balance row is token-specific, so the
   * server needs to know which token the user plans to pay in before
   * it can answer. Per spec + backend reply: this fires at step 2→3
   * with the default (`LASTSHFT`) and re-fires at step 4→5 if the
   * user picked a different token.
   */
  token: ProofTokenKey;
  /** Only used by the mock today — real endpoint infers from session. */
  scenario?: "eligible" | "ineligible";
  pubkey?: string;
  project?: string;
}

export function useEligibilityStream() {
  const [state, setState] = useState<EligibilityState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL);
  }, []);

  const start = useCallback(async (args: StartEligibilityArgs) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState({ ...INITIAL, status: "streaming" });

    try {
      const res = await fetch(ELIGIBILITY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          path: args.path,
          token: args.token.toLowerCase(),
          scenario: args.scenario ?? "eligible",
          pubkey: args.pubkey,
          project: args.project,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`eligibility stream failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Split on SSE record boundary (double newline)
        const records = buffer.split("\n\n");
        buffer = records.pop() ?? "";

        for (const record of records) {
          if (!record.trim()) continue;
          const lines = record.split("\n");
          let eventName = "message";
          let dataLine = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
          }
          if (!dataLine) continue;
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(dataLine);
          } catch {
            continue;
          }

          if (eventName === "start") {
            // no-op: state already initialized
          } else if (eventName === "check") {
            setState((s) => ({
              ...s,
              checks: [
                ...s.checks,
                {
                  id: payload.id as CheckIdLike,
                  label: payload.label as string,
                  ok: payload.ok as boolean | null,
                  detail: payload.detail as string,
                },
              ],
            }));
          } else if (eventName === "done") {
            setState((s) => ({
              ...s,
              status: "done",
              eligible: Boolean(payload.eligible),
              quote: (payload.eligible ? payload.quote : null) as
                | EligibilityState["quote"]
                | null,
              failedChecks: (payload.failed_checks as string[]) ?? [],
            }));
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState((s) => ({
        ...s,
        status: "error",
        error: (err as Error).message,
      }));
    }
  }, []);

  return { state, start, reset };
}

// Narrow helper for payload.id — the server is trusted but keep TS happy.
type CheckIdLike =
  | "uniqueness"
  | "slot"
  | "balance"
  | "mint_authority"
  | "deployer"
  | "founder";
