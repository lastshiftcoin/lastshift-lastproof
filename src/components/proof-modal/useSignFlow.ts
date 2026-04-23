"use client";

/**
 * Step 7 orchestrator: build-tx → verify expected_signer → sign →
 * broadcast → poll tx-status.
 *
 * Backend owns RPC. FE is a dumb client:
 *   1. POST /build-tx { quote_id } → { tx_base64, expected_signer, memo }
 *   2. Client-side: assert expected_signer === connected pubkey.
 *      Mismatch → signature_invalid (no broadcast).
 *   3. walletAdapter.signTransaction(Transaction.from(tx_base64))
 *   4. POST /broadcast { quote_id, signed_tx_base64 } → { signature, status }
 *   5. Poll GET /tx-status?signature=&started= every 1s until
 *      status ∈ {confirmed, failed} or FailureReason surfaces.
 *
 * Failure codes surfaced via `state.failure`:
 *   user_rejected           (wallet throw)
 *   insufficient_balance    (build-tx 402)
 *   quote_expired_hard      (build-tx 410)
 *   lock_lost               (build-tx 409)
 *   dev_slot_taken          (build-tx 409 distinct)
 *   rpc_degraded            (build-tx 503 OR tx-status 503)
 *   signature_invalid       (client-side mismatch OR broadcast 400)
 *   blockhash_expired       (tx-status failed)
 *   tx_reverted             (tx-status failed)
 *   unknown                 (any 5xx fallback)
 *
 * The hook does not own UI state transitions. Caller (ProofModal)
 * watches `state.phase` + `state.failure` and drives step 7 → 8.
 *
 * Talks to /api/proof/{build-tx,broadcast,tx-status} — real Solana
 * transaction endpoints. Mock versions at /api/mock/proof/* still exist
 * for local dev smoke testing.
 */

import { useCallback, useRef, useState } from "react";
import type { FailureReason } from "./types";

const BUILD_TX_URL = "/api/proof/build-tx";
const BROADCAST_URL = "/api/proof/broadcast";
const TX_STATUS_URL = "/api/proof/tx-status";
const POLL_MS = 1000;

export type SignPhase =
  | "idle"
  | "building"
  | "awaiting_signature"
  | "broadcasting"
  | "confirming"
  | "confirmed"
  | "failed";

export interface SignState {
  phase: SignPhase;
  signature: string | null;
  solscanUrl: string | null;
  failure: FailureReason | null;
  memo: string | null;
  /** Monotonic elapsed ms on the current phase, updated by poll ticks. */
  elapsedMs: number;
}

export interface StartSignArgs {
  quoteId: string;
  /** Connected wallet pubkey — asserted against build-tx's expected_signer. */
  pubkey: string;
  handle: string;
  ticker: string;
  path: "collab" | "dev";
  /**
   * Pass-through signer. Receives the `tx_base64` from /build-tx,
   * returns `signed_tx_base64`. Caller wires this up against the
   * real wallet adapter (Transaction.from → adapter.signTransaction →
   * serialize) or a dev-mock passthrough. If this throws, the hook
   * maps it to `user_rejected`.
   */
  signTransactionBase64: (txBase64: string) => Promise<string>;
  /** Optional scenario override for mock testing. */
  scenario?: string;
  /** Optional debug callback — fires for each sign-flow event. */
  onDebug?: (event: string, payload: Record<string, unknown>) => void;
}

const INITIAL: SignState = {
  phase: "idle",
  signature: null,
  solscanUrl: null,
  failure: null,
  memo: null,
  elapsedMs: 0,
};

export function useSignFlow() {
  const [state, setState] = useState<SignState>(INITIAL);
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
    (reason: FailureReason) => {
      stopPolling();
      setState((s) => ({ ...s, phase: "failed", failure: reason }));
    },
    [stopPolling],
  );

  const start = useCallback(
    async (args: StartSignArgs) => {
      const d = args.onDebug ?? (() => {});
      // Fresh run — cancel any in-flight and reset.
      stopPolling();
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setState({ ...INITIAL, phase: "building" });
      d("sign_flow_start", { quoteId: args.quoteId, pubkey: args.pubkey, path: args.path });

      // ─── 1. build-tx ────────────────────────────────────────────
      let tx_base64: string;
      let expected_signer: string;
      let memo: string;
      try {
        d("build_tx_request", { url: BUILD_TX_URL, quoteId: args.quoteId });
        const res = await fetch(BUILD_TX_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quote_id: args.quoteId,
            handle: args.handle,
            ticker: args.ticker,
            path: args.path,
            scenario: args.scenario,
          }),
          signal: ctrl.signal,
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          tx_base64?: string;
          expected_signer?: string;
          memo?: string;
          reason?: string;
        };

        d("build_tx_response", { status: res.status, ok: body.ok, reason: body.reason, hasTx: !!body.tx_base64, expectedSigner: body.expected_signer });

        if (!res.ok || body.ok === false) {
          const reason = (body.reason ?? "unknown") as FailureReason;
          const known: FailureReason[] = [
            "insufficient_balance",
            "quote_expired_hard",
            "lock_lost",
            "dev_slot_taken",
            "rpc_degraded",
            "unknown",
          ];
          d("build_tx_failed", { reason, status: res.status });
          fail(known.includes(reason) ? reason : "unknown");
          return;
        }

        tx_base64 = body.tx_base64!;
        expected_signer = body.expected_signer!;
        memo = body.memo ?? "";
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        d("build_tx_error", { message: (err as Error).message });
        fail("unknown");
        return;
      }

      setState((s) => ({ ...s, memo }));

      // ─── 2. verify expected_signer ──────────────────────────────
      if (expected_signer !== args.pubkey) {
        d("signer_mismatch", { expected: expected_signer, actual: args.pubkey });
        fail("signature_invalid");
        return;
      }

      // ─── 3. signTransaction ─────────────────────────────────────
      setState((s) => ({ ...s, phase: "awaiting_signature" }));
      d("awaiting_signature", { txLength: tx_base64.length });
      let signed_tx_base64: string;
      try {
        signed_tx_base64 = await args.signTransactionBase64(tx_base64);
        d("sign_complete", { signedLength: signed_tx_base64.length });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        d("sign_rejected", { message: (err as Error).message, name: (err as Error).name });
        fail("user_rejected");
        return;
      }

      // ─── 4. broadcast ───────────────────────────────────────────
      setState((s) => ({ ...s, phase: "broadcasting" }));
      d("broadcast_request", { url: BROADCAST_URL, quoteId: args.quoteId });
      let signature: string;
      try {
        const res = await fetch(BROADCAST_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quote_id: args.quoteId,
            signed_tx_base64,
            scenario: args.scenario,
          }),
          signal: ctrl.signal,
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          signature?: string;
          reason?: string;
          rpc_error?: string;
        };

        d("broadcast_response", { status: res.status, ok: body.ok, reason: body.reason, rpc_error: body.rpc_error, signature: body.signature });

        if (!res.ok || body.ok === false) {
          const reason = (body.reason ?? "unknown") as FailureReason;
          const known: FailureReason[] = [
            "signature_invalid",
            "rpc_degraded",
            "unknown",
          ];
          d("broadcast_failed", { reason, status: res.status });
          fail(known.includes(reason) ? reason : "unknown");
          return;
        }

        signature = body.signature!;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        d("broadcast_error", { message: (err as Error).message });
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
          if (args.scenario) url.searchParams.set("scenario", args.scenario);
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
            const reason = (body.reason ?? "unknown") as FailureReason;
            const known: FailureReason[] = [
              "blockhash_expired",
              "tx_reverted",
              "unknown",
            ];
            fail(known.includes(reason) ? reason : "unknown");
            return;
          }

          // broadcasted or confirming — keep going.
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

      // Fire once immediately, then interval.
      await poll();
      pollRef.current = window.setInterval(poll, POLL_MS);
    },
    [fail, stopPolling],
  );

  return { state, start, reset };
}
