import { sign, verify, generateKeyPairSync, createPrivateKey, createPublicKey, randomBytes } from "node:crypto";

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

/**
 * Generate a new Ed25519 keypair for agent identity.
 */
export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return {
    publicKey: publicKey.toString(),
    privateKey: privateKey.toString(),
  };
}

/**
 * Canonicalize a message for signing: sort keys, strip signature, no whitespace, UTF-8.
 */
export function canonicalize(message: Record<string, unknown>): string {
  const { signature: _, ...rest } = message;
  return JSON.stringify(sortKeys(rest));
}

function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Sign a message with a private key. Returns base64-encoded signature.
 */
export function signMessage(
  message: Record<string, unknown>,
  privateKey: string
): string {
  const data = Buffer.from(canonicalize(message));
  const key = createPrivateKey(privateKey);
  const sig = sign(null, data, key);
  return sig.toString("base64");
}

/**
 * Verify a message signature against a public key.
 */
export function verifyMessage(
  message: Record<string, unknown>,
  signature: string,
  publicKey: string
): boolean {
  const data = Buffer.from(canonicalize(message));
  const key = createPublicKey(publicKey);
  return verify(null, data, key, Buffer.from(signature, "base64"));
}

/**
 * Generate a prefixed unique ID.
 */
export function generateId(prefix: string): string {
  return `${prefix}${randomBytes(8).toString("hex")}`;
}

export function agentId(): string {
  return generateId("sk_");
}

export function messageId(): string {
  return generateId("msg_");
}

export function conversationId(): string {
  return generateId("conv_");
}
