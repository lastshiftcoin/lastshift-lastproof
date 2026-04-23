"use client";

/**
 * useDebugLog — client-side debug event logger for proof flow observability.
 *
 * Generates a stable session_id per hook instance (one per proof modal open).
 * Captures client metadata (userAgent, walletEnv, isAndroid) once and sends
 * it with every event. Events are fire-and-forget — failures are silently
 * swallowed so they never break the proof flow.
 *
 * Usage:
 *   const debug = useDebugLog();
 *   debug.log("wallet", "adapter_selected", { name: "Mobile Wallet Adapter" });
 *   debug.log("proof_flow", "step_transition", { from: 1, to: 2 });
 *   debug.log("api", "build_tx_response", { status: 200, body: data });
 */

import { useCallback, useMemo, useRef } from "react";
import { detectWalletEnvironment, isAndroid } from "@/lib/wallet/deep-link";

export type DebugCategory =
  | "wallet"
  | "proof_flow"
  | "api"
  | "sign"
  | "mwa"
  | "error";

interface QueuedEvent {
  session_id: string;
  category: string;
  event: string;
  payload: Record<string, unknown>;
  user_agent: string;
  wallet_env: string;
  is_android: boolean;
}

function generateSessionId(): string {
  return `dbg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useDebugLog() {
  const sessionId = useMemo(() => generateSessionId(), []);
  const queueRef = useRef<QueuedEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const meta = useMemo(() => {
    if (typeof window === "undefined") {
      return { user_agent: "ssr", wallet_env: "desktop", is_android: false };
    }
    return {
      user_agent: navigator.userAgent,
      wallet_env: detectWalletEnvironment(),
      is_android: isAndroid(),
    };
  }, []);

  const flush = useCallback(() => {
    if (queueRef.current.length === 0) return;
    const batch = queueRef.current.splice(0);
    fetch("/api/debug/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  const log = useCallback(
    (category: DebugCategory, event: string, payload: Record<string, unknown> = {}) => {
      queueRef.current.push({
        session_id: sessionId,
        category,
        event,
        payload: {
          ...payload,
          _ts: Date.now(),
        },
        ...meta,
      });

      // Debounce: flush after 200ms of quiet, or immediately if queue > 10
      if (queueRef.current.length >= 10) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
        flush();
      } else {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flush, 200);
      }
    },
    [sessionId, meta, flush],
  );

  return { log, sessionId, flush };
}
