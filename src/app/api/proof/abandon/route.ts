/**
 * POST /api/proof/abandon — release a quote lock.
 *
 * Called when the user closes the proof modal or navigates away before
 * completing payment. Marks the quote as expired so the slot (dev path)
 * or balance reservation is freed.
 *
 * Contract (matches docs/PROOF-MODAL-SPEC-REPLY.md §10 step 7):
 *   body: { quote_id }
 *   → 200 { released: true }                               (lock dropped)
 *   → 200 { released: false, reason: "already_consumed" }  (idempotent no-op)
 *   → 404 { released: false, reason: "quote_not_found" }
 */

import { NextRequest } from "next/server";
import { getQuote, markQuoteExpired } from "@/lib/quotes-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    quote_id?: string;
  } | null;

  if (!body?.quote_id) {
    return json({ error: "quote_id is required" }, 400);
  }

  const quote = await getQuote(body.quote_id);

  if (!quote) {
    return json({ released: false, reason: "quote_not_found" }, 404);
  }

  // Already paid — don't release
  if (quote.status === "consumed") {
    return json({ released: false, reason: "already_consumed" });
  }

  // Already expired — idempotent success
  if (quote.status === "expired") {
    return json({ released: true });
  }

  // Mark open quote as expired
  await markQuoteExpired(quote.id);
  return json({ released: true });
}
