import { NextRequest, NextResponse } from "next/server";
import { verifyHeliusRequest } from "@/lib/helius-verify";
import {
  upsertByTxSignature,
  markConfirmed,
  type PaymentDraft,
  type PaymentKind,
  type PaymentToken,
  type PaymentStatus,
} from "@/lib/payments-store";
import { dispatchPaymentConfirmed } from "@/lib/payment-events";
import { getQuote, getQuoteByReference, markQuoteConsumed } from "@/lib/quotes-store";
import { validatePaymentAgainstQuote } from "@/lib/tolerance";
import { parseHeliusEvents } from "@/lib/helius-parse";
import { isEnhancedEvent, markSeen, type HeliusEnhancedEvent } from "@/lib/helius-webhook";

/**
 * POST /api/payments/webhook — Helius enhanced webhook receiver.
 *
 * Responsibilities (in order, non-negotiable):
 *   1. Verify HMAC / shared-secret header. Reject 401 if missing or mismatched.
 *   2. Parse body → zero or more canonical PaymentDrafts.
 *   3. Upsert each by tx_signature (THE idempotency gate). Helius retries are
 *      normal — we MUST treat duplicate deliveries as no-ops.
 *   4. On first-seen transition pending→confirmed, dispatch exactly once.
 *   5. Always return 200 with a summary; Helius treats non-2xx as a retry
 *      signal which would amplify duplicates.
 *
 * ───────────────────────────────────────────────────────────────────────
 * PARSER STATUS:
 *
 * The real Helius enhanced-webhook payload is an array of events with
 * nativeTransfers / tokenTransfers / memo fields. Mapping that to canonical
 * PaymentDrafts requires the memo/reference scheme we'll lock in skeleton #3
 * (subscription) and skeleton #6 (proofs + dev verifications).
 *
 * For skeleton #2 this route accepts the canonical shape directly via a
 * `drafts` array in the body. This lets us verify the idempotency spine +
 * dispatch chain end-to-end without guessing at memo formats. When the real
 * parser lands it will sit in `lib/helius-parse.ts` and this handler will
 * call it instead of reading `body.drafts` directly — the rest of the
 * pipeline does not change.
 * ───────────────────────────────────────────────────────────────────────
 */

interface RawDraft {
  kind?: PaymentKind;
  refId?: string | null;
  operatorId?: string | null;
  profileId?: string | null;
  payerWallet?: string;
  token?: PaymentToken;
  amountUsd?: number;
  amountToken?: number;
  discountApplied?: boolean;
  txSignature?: string;
  status?: PaymentStatus;
  confirmedAt?: string | null;
  quoteId?: string | null;
}

function validateDraft(raw: RawDraft, index: number): PaymentDraft | { error: string } {
  if (
    !raw.kind ||
    !["subscription", "proof", "dev_verification", "handle_change"].includes(raw.kind)
  ) {
    return { error: `drafts[${index}].kind invalid or missing` };
  }
  if (!raw.txSignature || typeof raw.txSignature !== "string") {
    return { error: `drafts[${index}].txSignature required` };
  }
  if (!raw.payerWallet || typeof raw.payerWallet !== "string") {
    return { error: `drafts[${index}].payerWallet required` };
  }
  if (!raw.token || !["LASTSHFT", "SOL", "USDT"].includes(raw.token)) {
    return { error: `drafts[${index}].token invalid or missing` };
  }
  if (typeof raw.amountUsd !== "number" || raw.amountUsd < 0) {
    return { error: `drafts[${index}].amountUsd must be >= 0` };
  }
  if (typeof raw.amountToken !== "number" || raw.amountToken < 0) {
    return { error: `drafts[${index}].amountToken must be >= 0` };
  }

  const status: PaymentStatus = raw.status === "failed" ? "failed" : raw.status === "pending" ? "pending" : "confirmed";

  return {
    kind: raw.kind,
    refId: raw.refId ?? null,
    operatorId: raw.operatorId ?? null,
    profileId: raw.profileId ?? null,
    payerWallet: raw.payerWallet,
    token: raw.token,
    amountUsd: raw.amountUsd,
    amountToken: raw.amountToken,
    discountApplied: Boolean(raw.discountApplied),
    quoteId: raw.quoteId ?? null,
    txSignature: raw.txSignature,
    status,
    confirmedAt: raw.confirmedAt ?? (status === "confirmed" ? new Date().toISOString() : null),
  };
}

interface ProcessedEntry {
  txSignature: string;
  created: boolean;
  dispatched: boolean;
  kind: PaymentKind;
  note: string;
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const auth = verifyHeliusRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, reason: auth.reason }, { status: 401 });
  }

  // 2. Parse — accept EITHER the canonical drafts[] (dev harness) OR
  //    a real Helius enhanced-webhook events[] payload (production).
  //    If events[] is present we run it through lib/helius-parse.ts,
  //    which resolves quotes by reference and emits canonical drafts.
  let body: { drafts?: RawDraft[]; events?: HeliusEnhancedEvent[] };
  try {
    body = (await req.json()) as { drafts?: RawDraft[]; events?: HeliusEnhancedEvent[] };
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  let rawDrafts: RawDraft[] = [];
  let parserSkipped: Array<{ signature: string; reason: string }> = [];

  if (Array.isArray(body.events) && body.events.length > 0) {
    // Enforce Enhanced-mode shape + replay-guard on tx signature.
    // Helius auth is a plain Authorization header (no HMAC, no timestamp),
    // so we protect ourselves from short-window replays here; the payments
    // store idempotency catches longer-range duplicates.
    const accepted: HeliusEnhancedEvent[] = [];
    for (const ev of body.events) {
      if (!isEnhancedEvent(ev)) {
        parserSkipped.push({
          signature: (ev as { signature?: string })?.signature ?? "unknown",
          reason: "not_enhanced_mode",
        });
        continue;
      }
      if (!markSeen(ev.signature)) {
        parserSkipped.push({ signature: ev.signature, reason: "replay_suppressed" });
        continue;
      }
      accepted.push(ev);
    }
    const treasury = process.env.TREASURY_WALLET || "LASTPROOF_TREASURY_STUB";
    const parsed = parseHeliusEvents(accepted, {
      treasuryWallet: treasury,
      resolveQuote: getQuoteByReference,
    });
    rawDrafts = parsed.drafts as RawDraft[];
    parserSkipped = [...parserSkipped, ...parsed.skipped];
  } else if (Array.isArray(body.drafts) && body.drafts.length > 0) {
    rawDrafts = body.drafts;
  } else {
    return NextResponse.json(
      { ok: false, reason: "drafts_or_events_required" },
      { status: 400 },
    );
  }

  // 3–4. Upsert + dispatch
  const processed: ProcessedEntry[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rawDrafts.length; i++) {
    const validated = validateDraft(rawDrafts[i], i);
    if ("error" in validated) {
      errors.push(validated.error);
      continue;
    }

    // Quote validation (if quoteId present). Tolerance/dust/mismatch
    // rejections short-circuit BEFORE we upsert, so the payments table
    // never gets polluted with bad drafts.
    //
    // IMPORTANT: we do NOT call `markQuoteConsumed` here — that happens
    // AFTER the upsert succeeds (Q43 fix). Consuming the quote before
    // the payments row is committed opens a window where a crash
    // between the two would leave the quote burned with no payment
    // record, making the user unable to retry. `validatePaymentAgainstQuote`
    // must tolerate a re-run on the same still-open quote for this to
    // be safe.
    let resolvedQuote: ReturnType<typeof getQuote> = null;
    if (validated.quoteId) {
      resolvedQuote = getQuote(validated.quoteId);
      const check = validatePaymentAgainstQuote({
        quote: resolvedQuote,
        paidToken: validated.token,
        paidUsd: validated.amountUsd,
        paidToken_amount: validated.amountToken,
      });
      if (!check.ok) {
        errors.push(`drafts[${i}].quote:${check.reason}${check.detail ? ` (${check.detail})` : ""}`);
        continue;
      }
    }

    const upsert = await upsertByTxSignature(validated);

    // Consume the quote ONLY on a newly-created payment row. Duplicate
    // deliveries of the same tx_signature are no-ops here: the quote
    // is already consumed from the first delivery.
    if (upsert.created && resolvedQuote) {
      markQuoteConsumed(resolvedQuote.id, validated.txSignature);
    }

    let dispatched = false;
    let note = "existing row — no-op";

    // Dispatcher is wrapped in try/catch so a bad handler for one draft
    // never poisons the rest of the batch. Helius retries are still
    // idempotent because the payments row is already committed.
    try {
      if (upsert.created && upsert.row.status === "confirmed") {
        const result = await dispatchPaymentConfirmed(upsert.row);
        dispatched = result.handled;
        note = result.note;
      } else if (upsert.created && upsert.row.status === "pending") {
        note = "new pending — awaiting confirmation delivery";
      } else if (
        !upsert.created &&
        upsert.row.status === "pending" &&
        validated.status === "confirmed"
      ) {
        const confirmed = await markConfirmed(
          validated.txSignature,
          validated.confirmedAt ?? undefined,
        );
        if (confirmed) {
          const result = await dispatchPaymentConfirmed(confirmed);
          dispatched = result.handled;
          note = `transition pending→confirmed; ${result.note}`;
        }
      }
    } catch (err) {
      const msg = (err as Error).message ?? "unknown_dispatcher_error";
      errors.push(`drafts[${i}].dispatch:${msg}`);
      note = `dispatch_failed:${msg}`;
    }

    processed.push({
      txSignature: upsert.row.txSignature,
      created: upsert.created,
      dispatched,
      kind: upsert.row.kind,
      note,
    });
  }

  // 5. Always 200 — duplicates and validation errors are reported in the body, not the status.
  return NextResponse.json({
    ok: errors.length === 0,
    processed,
    errors,
    parserSkipped,
  });
}
