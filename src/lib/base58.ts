/**
 * Minimal base58 encoder/decoder (Bitcoin/Solana alphabet).
 *
 * Zero-dependency so we don't pull `bs58` just to serialize 32-byte
 * references. This matches the output of `bs58.encode(Buffer)` and
 * `Keypair.generate().publicKey.toBase58()` for arbitrary byte arrays.
 *
 * Correctness notes:
 *   - Leading 0x00 bytes encode to leading '1' characters, per spec.
 *   - We use bigint for the divmod loop; for 32 bytes this is trivial.
 *   - Decode is included so tests / future validators can round-trip.
 */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE = BigInt(58);

export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) leadingZeros++;

  let num = BigInt(0);
  for (const b of bytes) num = (num << BigInt(8)) + BigInt(b);

  let out = "";
  while (num > BigInt(0)) {
    const rem = num % BASE;
    num = num / BASE;
    out = ALPHABET[Number(rem)] + out;
  }
  return "1".repeat(leadingZeros) + out;
}

export function decodeBase58(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array();
  let leadingOnes = 0;
  while (leadingOnes < str.length && str[leadingOnes] === "1") leadingOnes++;

  let num = BigInt(0);
  for (const ch of str) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error(`invalid base58 char: ${ch}`);
    num = num * BASE + BigInt(idx);
  }

  const bytes: number[] = [];
  while (num > BigInt(0)) {
    bytes.unshift(Number(num & BigInt(0xff)));
    num >>= BigInt(8);
  }
  return new Uint8Array([...new Array(leadingOnes).fill(0), ...bytes]);
}

/**
 * Generate a fresh Solana-Pay-spec-compliant reference:
 * 32 random bytes, base58-encoded. This is the SAME wire format as
 * `Keypair.generate().publicKey.toBase58()`, so spec-compliant wallets
 * (Phantom, Solflare) will round-trip it cleanly.
 */
export function generateReferenceBase58(): string {
  // node:crypto is available on the server — webhook + quote route only.
  // Dynamic require keeps edge bundlers from complaining.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomBytes } = require("node:crypto") as typeof import("node:crypto");
  return encodeBase58(new Uint8Array(randomBytes(32)));
}
