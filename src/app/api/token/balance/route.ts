export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { LASTSHFT_MINT } from "@/lib/constants";

/**
 * GET /api/token/balance
 *
 * Returns the session wallet's $LASTSHFT balance.
 * Uses raw JSON-RPC (same as Terminal's /api/balance) — no @solana/web3.js.
 */

const RPC_URL =
  process.env.HELIUS_RPC_URL ||
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ ok: false, reason: "no_session" }, { status: 401 });
  }

  const wallet = session.walletAddress;

  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          wallet,
          { mint: LASTSHFT_MINT },
          { encoding: "jsonParsed" },
        ],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ ok: true, balance: 0 });
    }

    const data = await res.json();
    const accounts = data?.result?.value;

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ ok: true, balance: 0 });
    }

    const amount =
      accounts[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;

    return NextResponse.json({ ok: true, balance: amount });
  } catch {
    return NextResponse.json({ ok: true, balance: 0 });
  }
}
