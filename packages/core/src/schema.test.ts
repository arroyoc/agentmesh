import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AgentCardSchema, MessageSchema, DirectoryQuerySchema } from "./schema.js";

describe("AgentCardSchema", () => {
  const validCard = {
    squadklaw: "0.1.0",
    agent_id: "sk_abc123def456",
    name: "Test Agent",
    endpoint: "https://example.com/squadklaw",
    public_key: "test-public-key",
    capabilities: ["scheduling"],
    intents: ["mesh.schedule"],
  };

  it("validates a minimal valid agent card", () => {
    const result = AgentCardSchema.safeParse(validCard);
    assert.equal(result.success, true);
  });

  it("validates a full agent card with optional fields", () => {
    const full = {
      ...validCard,
      description: "A test agent",
      owner: { name: "Chris", contact: "chris@example.com" },
      availability: { timezone: "America/Los_Angeles", hours: "always", response_sla: "5m" },
      access_control: { mode: "allowlist" as const, allowlist: ["sk_friend1"] },
      metadata: { version: "1.0" },
    };
    const result = AgentCardSchema.safeParse(full);
    assert.equal(result.success, true);
  });

  it("rejects agent_id without sk_ prefix", () => {
    const result = AgentCardSchema.safeParse({ ...validCard, agent_id: "am_wrong" });
    assert.equal(result.success, false);
  });

  it("rejects empty name", () => {
    const result = AgentCardSchema.safeParse({ ...validCard, name: "" });
    assert.equal(result.success, false);
  });

  it("rejects invalid endpoint URL", () => {
    const result = AgentCardSchema.safeParse({ ...validCard, endpoint: "not-a-url" });
    assert.equal(result.success, false);
  });

  it("rejects empty capabilities", () => {
    const result = AgentCardSchema.safeParse({ ...validCard, capabilities: [] });
    assert.equal(result.success, false);
  });

  it("rejects empty intents", () => {
    const result = AgentCardSchema.safeParse({ ...validCard, intents: [] });
    assert.equal(result.success, false);
  });

  it("allows http endpoints for local dev", () => {
    const result = AgentCardSchema.safeParse({ ...validCard, endpoint: "http://localhost:3142/squadklaw" });
    assert.equal(result.success, true);
  });
});

describe("MessageSchema", () => {
  const validMessage = {
    squadklaw: "0.1.0",
    message_id: "msg_abc123def456",
    conversation_id: "conv_abc123def456",
    from: "sk_sender123",
    to: "sk_receiver456",
    timestamp: "2026-02-20T10:00:00.000Z",
    intent: "mesh.schedule",
    payload: { action: "propose" },
    signature: "base64signature",
  };

  it("validates a valid message", () => {
    const result = MessageSchema.safeParse(validMessage);
    assert.equal(result.success, true);
  });

  it("rejects message_id without msg_ prefix", () => {
    const result = MessageSchema.safeParse({ ...validMessage, message_id: "bad_id" });
    assert.equal(result.success, false);
  });

  it("rejects conversation_id without conv_ prefix", () => {
    const result = MessageSchema.safeParse({ ...validMessage, conversation_id: "bad_id" });
    assert.equal(result.success, false);
  });

  it("rejects from without sk_ prefix", () => {
    const result = MessageSchema.safeParse({ ...validMessage, from: "am_old" });
    assert.equal(result.success, false);
  });

  it("rejects invalid timestamp", () => {
    const result = MessageSchema.safeParse({ ...validMessage, timestamp: "not-a-date" });
    assert.equal(result.success, false);
  });

  it("rejects empty signature", () => {
    const result = MessageSchema.safeParse({ ...validMessage, signature: "" });
    assert.equal(result.success, false);
  });
});

describe("DirectoryQuerySchema", () => {
  it("provides defaults for empty query", () => {
    const result = DirectoryQuerySchema.safeParse({});
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.limit, 20);
    }
  });

  it("accepts valid query params", () => {
    const result = DirectoryQuerySchema.safeParse({
      capability: "scheduling",
      intent: "mesh.schedule",
      q: "coffee",
      limit: "50",
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.limit, 50);
    }
  });

  it("rejects limit over 100", () => {
    const result = DirectoryQuerySchema.safeParse({ limit: "200" });
    assert.equal(result.success, false);
  });

  it("rejects limit of 0", () => {
    const result = DirectoryQuerySchema.safeParse({ limit: "0" });
    assert.equal(result.success, false);
  });
});
