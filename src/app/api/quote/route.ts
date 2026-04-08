import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getProfileByOperatorId } from "@/lib/profiles-store";
import { issueQuote, hasOpenHandleChangeQuote } from "@/lib/quotes-store";
import { getTokenUsdRate } from "@/lib/token-rates";
import type { PaymentKindPriced, PaymentToken } from "@/lib/pricing";
import { checkHandleCooldown } from "@/lib/handle-cooldown";
import { buildTransferRequestUri, formatAmount } from "@/lib/solana-pay";
import { TOKEN_DECIMALS } from "@/lib/constants";
import { classifyWallet } from "@/lib/wallet-policy";

const VALID_KINDS: PaymentKindPriced[] = [
  "proof",
  "dev_verification",
  "subscription",
  "handle_change",
];
const VALID_TOKENS: PaymentToken[] = ["LASTSHFT", "SOL", "USDT"];

/**
 * POST /api/quote  { kind, token, metadata? }
 * Session-gated. Returns a locked quote the webhook later validates.
 */
export async function POST(req: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ ok: false, reason: "no_session" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    kind?: PaymentKindPriced;
    token?: PaymentToken;
    metadata?: Record<string, unknown>;
    /**
     * Optional — the wallet-adapter name string the client is about
     * to sign with. When present we enforce the wallet policy here so
     * the user sees the gate BEFORE we burn a reference + expire a
     * quote TTL slot. When absent (legacy callers) we proceed and let
     * the pay modal run the classification later.
     */
    walletAdapter?: string;
  };

  if (body.walletAdapter !== undefined) {
    const classification = classifyWallet(body.walletAdapter);
    if (classification.tier === "blocked") {
      return NextResponse.json(
        {
          ok: false,
          reason: "wallet_not_allowlisted",
          classification,
        },
        { status: 403 },
      );
    }
  }

  if (!body.kind || !VALID_KINDS.includes(body.kind)) {
    return NextResponse.json({ ok: false, reason: "invalid_kind" }, { status: 400 });
  }
  if (!body.token || !VALID_TOKENS.includes(body.token)) {
    return NextResponse.json({ ok: false, reason: "invalid_token" }, { status: 400 });
  }

  const profile = await getProfileByOperatorId(session.walletAddress);
  if (!profile) {
    return NextResponse.json({ ok: false, reason: "profile_not_found" }, { status: 404 });
  }

  // Handle change: enforce cooldown + single-in-flight
  if (body.kind === "handle_change") {
    const cooldown = await checkHandleCooldown(profile.id);
    if (!cooldown.eligible) {
      return NextResponse.json(
        {
          ok: false,
          reason: "handle_cooldown_active",
          lastChangedAt: cooldown.lastChangedAt,
          nextEligibleAt: cooldown.nextEligibleAt,
          daysRemaining: cooldown.daysRemaining,
        },
        { status: 409 },
      );
    }
    if (await hasOpenHandleChangeQuote(profile.id)) {
      return NextResponse.json(
        { ok: false, reason: "handle_change_already_pending" },
        { status: 409 },
      );
    }
  }

  const tokenUsdRate = await getTokenUsdRate(body.token);
  const quote = issueQuote({
    profileId: profile.id,
    kind: body.kind,
    token: body.token,
    tokenUsdRate,
    metadata: body.metadata,
  });

  // Build the Solana Pay Transfer Request URI that the client will
  // hand to the wallet (via QR or deep-link). This is the SINGLE
  // handoff from backend to wallet — the wallet reads `reference`
  // and includes it as a read-only account key, which is what the
  // Helius webhook later uses to correlate the on-chain tx back to
  // THIS quote row. Build here (not in the client) so every channel
  // (QR, deep-link, copy-to-clipboard) emits identical URIs.
  const treasury =
    process.env.LASTPROOF_AR_WALLET ||
    process.env.TREASURY_WALLET ||
    "LASTPROOF_TREASURY_STUB";

  let solanaPayUri: string | null = null;
  try {
    solanaPayUri = buildTransferRequestUri({
      recipient: treasury,
      amount: formatAmount(quote.expectedToken, TOKEN_DECIMALS[quote.token]),
      token: quote.token,
      references: [quote.reference],
      label: "LASTPROOF",
      message: `${quote.kind} payment`,
    });
  } catch (err) {
    // Non-fatal: the quote is still valid and the client can fall back
    // to a Transaction Request flow. We log and continue.
    console.error(`[quote] failed to build Solana Pay URI: ${(err as Error).message}`);
  }

  return NextResponse.json({
    ok: true,
    quote: {
      id: quote.id,
      reference: quote.reference,
      kind: quote.kind,
      token: quote.token,
      expectedUsd: quote.expectedUsd,
      expectedToken: quote.expectedToken,
      tokenUsdRate: quote.tokenUsdRate,
      expiresAt: quote.expiresAt,
      recipient: treasury,
      solanaPayUri,
    },
    wallet: body.walletAdapter
      ? classifyWallet(body.walletAdapter)
      : null,
  });
}
