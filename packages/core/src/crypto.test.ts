import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateKeyPair,
  canonicalize,
  signMessage,
  verifyMessage,
  agentId,
  messageId,
  conversationId,
} from "./crypto.js";

describe("generateKeyPair", () => {
  it("returns a public and private key in PEM format", () => {
    const keys = generateKeyPair();
    assert.ok(keys.publicKey.startsWith("-----BEGIN PUBLIC KEY-----"));
    assert.ok(keys.privateKey.startsWith("-----BEGIN PRIVATE KEY-----"));
  });

  it("generates unique keypairs each time", () => {
    const a = generateKeyPair();
    const b = generateKeyPair();
    assert.notEqual(a.publicKey, b.publicKey);
    assert.notEqual(a.privateKey, b.privateKey);
  });
});

describe("canonicalize", () => {
  it("sorts keys alphabetically", () => {
    const result = canonicalize({ z: 1, a: 2, m: 3 });
    assert.equal(result, '{"a":2,"m":3,"z":1}');
  });

  it("strips the signature field", () => {
    const result = canonicalize({ a: 1, signature: "should-be-removed", b: 2 });
    assert.equal(result, '{"a":1,"b":2}');
  });

  it("sorts nested objects", () => {
    const result = canonicalize({ b: { z: 1, a: 2 }, a: 1 });
    assert.equal(result, '{"a":1,"b":{"a":2,"z":1}}');
  });

  it("preserves array order", () => {
    const result = canonicalize({ arr: [3, 1, 2] });
    assert.equal(result, '{"arr":[3,1,2]}');
  });
});

describe("signMessage / verifyMessage", () => {
  it("signs a message and verifies with correct key", () => {
    const keys = generateKeyPair();
    const message = { from: "sk_alice", to: "sk_bob", intent: "mesh.schedule" };

    const signature = signMessage(message, keys.privateKey);
    assert.ok(typeof signature === "string");
    assert.ok(signature.length > 0);

    const valid = verifyMessage(message, signature, keys.publicKey);
    assert.equal(valid, true);
  });

  it("fails verification with wrong key", () => {
    const keysA = generateKeyPair();
    const keysB = generateKeyPair();
    const message = { from: "sk_alice", to: "sk_bob", intent: "mesh.schedule" };

    const signature = signMessage(message, keysA.privateKey);
    const valid = verifyMessage(message, signature, keysB.publicKey);
    assert.equal(valid, false);
  });

  it("fails verification when message is tampered", () => {
    const keys = generateKeyPair();
    const message = { from: "sk_alice", to: "sk_bob", intent: "mesh.schedule" };

    const signature = signMessage(message, keys.privateKey);
    const tampered = { ...message, intent: "mesh.negotiate" };
    const valid = verifyMessage(tampered, signature, keys.publicKey);
    assert.equal(valid, false);
  });

  it("signature is deterministic for same message and key", () => {
    const keys = generateKeyPair();
    const message = { from: "sk_alice", to: "sk_bob", intent: "mesh.schedule" };

    const sig1 = signMessage(message, keys.privateKey);
    const sig2 = signMessage(message, keys.privateKey);
    // Ed25519 is deterministic
    assert.equal(sig1, sig2);
  });
});

describe("ID generators", () => {
  it("agentId starts with sk_", () => {
    const id = agentId();
    assert.ok(id.startsWith("sk_"));
    assert.equal(id.length, 19); // "sk_" + 16 hex chars
  });

  it("messageId starts with msg_", () => {
    const id = messageId();
    assert.ok(id.startsWith("msg_"));
  });

  it("conversationId starts with conv_", () => {
    const id = conversationId();
    assert.ok(id.startsWith("conv_"));
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => agentId()));
    assert.equal(ids.size, 100);
  });
});
