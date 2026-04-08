/**
 * Proofs store — in-memory stub mirroring `proofs` + `dev_verifications`
 * tables. Swap to Supabase later without touching callers.
 *
 * A proof row is created ONCE per confirmed payment (idempotency held
 * upstream by payments-store via tx_signature). DEV verifications are a
 * distinct kind — same store, different row shape flag.
 */

export interface ProofRow {
  id: string;
  profileId: string;
  workItemId: string | null;
  kind: "proof" | "dev_verification";
  txSignature: string;
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
  rows.push(row);

  const mode = getStoreMode("proofs");
  if (mode === "dual" || mode === "supabase") {
    fireAndForget("insertProof", proofsDb.insertProofRow(row));
  }
  return row;
}

export function countConfirmedProofs(profileId: string): number {
  return rows.filter((r) => r.profileId === profileId && r.kind === "proof").length;
}

export function countDevVerifications(profileId: string): number {
  return rows.filter((r) => r.profileId === profileId && r.kind === "dev_verification")
    .length;
}

export function hasProofForTx(txSignature: string): boolean {
  return rows.some((r) => r.txSignature === txSignature);
}

export function listProofs(profileId?: string): ProofRow[] {
  return profileId ? rows.filter((r) => r.profileId === profileId) : rows.slice();
}

export function __resetProofs(): void {
  rows.length = 0;
}
