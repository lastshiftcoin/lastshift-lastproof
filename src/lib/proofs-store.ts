/**
 * Proofs store — memory | dual | supabase dispatch.
 *
 * A proof row is created ONCE per confirmed payment (idempotency held
 * upstream by payments-store via tx_signature). DEV verifications are a
 * distinct kind — same store, different `kind` flag.
 */

export interface ProofRow {
  id: string;
  profileId: string;
  workItemId: string | null;
  kind: "proof" | "dev_verification";
  txSignature: string;
  payerWallet: string | null;
  createdAt: string;
}

import { getStoreMode } from "./db/mode";
import * as proofsDb from "./db/proofs-adapter";

function fireAndForget(label: string, p: Promise<unknown>): void {
  p.catch((err) => {
    console.error(`[proofs-store] dual-write ${label} failed:`, err);
  });
}

const rows: ProofRow[] = [];

export function insertProof(input: Omit<ProofRow, "id" | "createdAt">): ProofRow {
  const row: ProofRow = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const mode = getStoreMode("proofs");
  // Mirror into memory regardless so sync callers keep working; in
  // supabase mode reads go through the adapter so memory is just a
  // harmless local cache.
  rows.push(row);
  if (mode === "dual" || mode === "supabase") {
    fireAndForget("insertProof", proofsDb.insertProofRow(row));
  }
  return row;
}

export async function countConfirmedProofs(profileId: string): Promise<number> {
  if (getStoreMode("proofs") === "supabase") {
    return proofsDb.countProofsByProfile(profileId, "proof");
  }
  return rows.filter((r) => r.profileId === profileId && r.kind === "proof").length;
}

export async function countDevVerifications(profileId: string): Promise<number> {
  if (getStoreMode("proofs") === "supabase") {
    return proofsDb.countProofsByProfile(profileId, "dev_verification");
  }
  return rows.filter((r) => r.profileId === profileId && r.kind === "dev_verification")
    .length;
}

export async function hasProofForTx(txSignature: string): Promise<boolean> {
  if (getStoreMode("proofs") === "supabase") {
    // Rare path — scan by profile would require an index; for now no
    // caller uses this in supabase mode. Fall back to memory cache.
    return rows.some((r) => r.txSignature === txSignature);
  }
  return rows.some((r) => r.txSignature === txSignature);
}

export async function listProofs(profileId?: string): Promise<ProofRow[]> {
  if (getStoreMode("proofs") === "supabase" && profileId) {
    return proofsDb.listProofsByProfile(profileId);
  }
  return profileId ? rows.filter((r) => r.profileId === profileId) : rows.slice();
}

export function __resetProofs(): void {
  rows.length = 0;
}
