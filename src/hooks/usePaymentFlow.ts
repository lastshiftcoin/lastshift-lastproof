"use client";

/**
 * Generic payment flow orchestrator: build-tx → sign → broadcast → poll.
 *
 * Simplified version of proof-modal/useSignFlow.ts. Same phase machine
 * and failure codes, but:
 *   - Hits /api/payment/{build-tx, broadcast, tx-status} (generic routes)
 *   - Args: { quoteId, pubkey, signTransactionBase64 } — no proof-specific params
 *   - Body to build-tx: just { quote_id } — the quote carries everything
 *
 * Used by PaymentModal for subscription, handle_change, and mint flows.
 * ProofModal continues to use useSignFlow — do NOT modify that hook.
 */

import { useCallback, useRef, useState } from "react";

const BUILD_TX_URL = "/api/payment/build-tx";
const BROADCAST_URL = "/api/payment/broadcast";
const TX_STATUS_URL = "/api/payment/tx-status";
const POLL_MS = 1000;

export type PaymentPhase =
  | "idle"
  | "building"
  | "awaiting_signature"
  | "broadcasting"
  | "confirming"
  | "confirmed"
  | "failed";

export type PaymentFailure =
  | "user_rejected"
  | "insufficient_balance"
  | "blockhash_expired"
  | "tx_reverted"
  | "rpc_degraded"
  | "quote_expired_hard"
  | "lock_lost"
  | "signature_invalid"
  | "unknown";

export interface PaymentFlowState {
  phase: PaymentPhase;
  signature: string | null;
  solscanUrl: string | null;
  failure: PaymentFailure | null;
  memo: string | null;
  elapsedMs: number;
}

export interface StartPaymentArgs {
  quoteId: string;
  pubkey: string;
  signTransactionBase64: (txBase64: string) => Promise<string>;
}

const INITIAL: PaymentFlowState = {
  phase: "idle",
  signature: null,
  solscanUrl: null,
  failure: null,
  memo: null,
  elapsedMs: 0,
};

export function usePaymentFlow() {
  const [state, setState] = useState<PaymentFlowState>(INITIAL);
  const pollRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL);
  }, [stopPolling]);

  const fail = useCallback(
    (reason: PaymentFailure) => {
      stopPolling();
      setState((s) => ({ ...s, phase: "failed", failure: reason }));
    },
    [stopPolling],
  );

  const start = useCallback(
    async (args: StartPaymentArgs) => {
      stopPolling();
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setState({ ...INITIAL, phase: "building" });

      // ─── 1. build-tx ────────────────────────────────────────────
      let tx_base64: string;
      let expected_signer: string;
      let memo: string;
      try {
        const res = await fetch(BUILD_TX_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quote_id: args.quoteId }),
          signal: ctrl.signal,
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          tx_base64?: string;
          expected_signer?: string;
          memo?: string;
          reason?: string;
        };

        if (!res.ok || body.ok === false) {
          const reason = (body.reason ?? "unknown") as PaymentFailure;
          const known: PaymentFailure[] = [
            "insufficient_balance",
            "quote_expired_hard",
            "lock_lost",
            "rpc_degraded",
            "unknown",
          ];
          fail(known.includes(reason) ? reason : "unknown");
          return;
        }

        tx_base64 = body.tx_base64!;
        expected_signer = body.expected_signer!;
        memo = body.memo ?? "";
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        fail("unknown");
        return;
      }

      setState((s) => ({ ...s, memo }));

      // ─── 2. verify expected_signer ──────────────────────────────
      if (expected_signer !== args.pubkey) {
        fail("signature_invalid");
        return;
      }

      // ─── 3. signTransaction ─────────────────────────────────────
      setState((s) => ({ ...s, phase: "awaiting_signature" }));
      let signed_tx_base64: string;
      try {
        signed_tx_base64 = await args.signTransactionBase64(tx_base64);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        fail("user_rejected");
        return;
      }

      // ─── 4. broadcast ───────────────────────────────────────────
      setState((s) => ({ ...s, phase: "broadcasting" }));
      let signature: string;
      try {
        const res = await fetch(BROADCAST_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quote_id: args.quoteId,
            signed_tx_base64,
          }),
          signal: ctrl.signal,
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          signature?: string;
          reason?: string;
        };

        if (!res.ok || body.ok === false) {
          const reason = (body.reason ?? "unknown") as PaymentFailure;
          const known: PaymentFailure[] = [
            "signature_invalid",
            "rpc_degraded",
            "unknown",
          ];
          fail(known.includes(reason) ? reason : "unknown");
          return;
        }

        signature = body.signature!;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        fail("unknown");
        return;
      }

      setState((s) => ({ ...s, signature, phase: "confirming" }));

      // ─── 5. poll tx-status every 1s ─────────────────────────────
      const started = Date.now();
      const poll = async () => {
        try {
          const url = new URL(TX_STATUS_URL, window.location.origin);
          url.searchParams.set("signature", signature);
          url.searchParams.set("started", String(started));
          const res = await fetch(url.toString(), { signal: ctrl.signal });

          if (res.status === 503) {
            fail("rpc_degraded");
            return;
          }

          const body = (await res.json().catch(() => ({}))) as {
            ok?: boolean;
            status?: "broadcasted" | "confirming" | "confirmed" | "failed";
            reason?: string;
            elapsed_ms?: number;
            solscan_url?: string | null;
          };

          if (!res.ok) {
            fail("unknown");
            return;
          }

          const nextElapsed = body.elapsed_ms ?? Date.now() - started;

          if (body.status === "confirmed") {
            stopPolling();
            setState((s) => ({
              ...s,
              phase: "confirmed",
              solscanUrl: body.solscan_url ?? null,
              elapsedMs: nextElapsed,
            }));
            return;
          }

          if (body.status === "failed") {
            const reason = (body.reason ?? "unknown") as PaymentFailure;
            const known: PaymentFailure[] = [
              "blockhash_expired",
              "tx_reverted",
              "unknown",
            ];
            fail(known.includes(reason) ? reason : "unknown");
            return;
          }

          setState((s) => ({
            ...s,
            phase: body.status === "broadcasted" ? "broadcasting" : "confirming",
            elapsedMs: nextElapsed,
          }));
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
          // Transient — next tick will retry.
        }
      };

      await poll();
      pollRef.current = window.setInterval(poll, POLL_MS);
    },
    [fail, stopPolling],
  );

  return { state, start, reset };
}
