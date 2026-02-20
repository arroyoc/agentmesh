import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { AgentCardSchema, DirectoryQuerySchema, MessageSchema, agentId, generateId } from "@squadklaw/core";
import {
  putAgent,
  getAgent,
  deleteAgent,
  searchAgents,
  countAgents,
  getAgentByTokenHash,
  storeMessage,
  getMessagesFor,
  getMessagesInConversation,
  ackMessage,
  ackAllMessages,
} from "./store.js";
import { createHash } from "node:crypto";

const app = new Hono();

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Resolve agent_id from bearer token. Returns null if unauthorized. */
function resolveAgent(authHeader: string | undefined): { agentId: string; tokenHash: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const tokenHash = hashToken(token);
  const agent = getAgentByTokenHash(tokenHash);
  if (!agent) return null;
  return { agentId: agent.card.agent_id, tokenHash };
}

// ── Health check ────────────────────────────────────────

app.get("/", (c) => {
  return c.json({
    name: "Squad Klaw Directory",
    version: "0.1.0",
    agents: countAgents(),
  });
});

// ── Agent registration ──────────────────────────────────

app.post("/v1/agents", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Missing bearer token", retry: false } },
      401,
    );
  }

  const token = authHeader.slice(7);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { code: "INVALID_MESSAGE", message: "Invalid JSON body", retry: false } },
      400,
    );
  }

  const parsed = AgentCardSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "INVALID_MESSAGE",
          message: `Validation failed: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
          retry: false,
        },
      },
      400,
    );
  }

  const card = parsed.data;
  const id = agentId();
  card.agent_id = id;

  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  putAgent({
    card: card as any,
    registered_at: now.toISOString(),
    expires_at: expires.toISOString(),
    token_hash: hashToken(token),
  });

  return c.json(
    {
      agent_id: id,
      registered_at: now.toISOString(),
      expires_at: expires.toISOString(),
    },
    201,
  );
});

// ── Agent discovery ─────────────────────────────────────

app.get("/v1/agents", (c) => {
  const raw = {
    capability: c.req.query("capability"),
    intent: c.req.query("intent"),
    q: c.req.query("q"),
    limit: c.req.query("limit"),
    cursor: c.req.query("cursor"),
  };

  const parsed = DirectoryQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "INVALID_MESSAGE",
          message: `Invalid query: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
          retry: false,
        },
      },
      400,
    );
  }

  const results = searchAgents(parsed.data);
  return c.json(results);
});

// ── Get agent by ID ─────────────────────────────────────

app.get("/v1/agents/:id", (c) => {
  const id = c.req.param("id");
  const stored = getAgent(id);

  if (!stored) {
    return c.json(
      { error: { code: "AGENT_UNAVAILABLE", message: "Agent not found", retry: false } },
      404,
    );
  }

  return c.json(stored.card);
});

// ── Update agent ────────────────────────────────────────

app.put("/v1/agents/:id", async (c) => {
  const id = c.req.param("id");
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Missing bearer token", retry: false } },
      401,
    );
  }

  const token = authHeader.slice(7);
  const stored = getAgent(id);

  if (!stored) {
    return c.json(
      { error: { code: "AGENT_UNAVAILABLE", message: "Agent not found", retry: false } },
      404,
    );
  }

  if (stored.token_hash !== hashToken(token)) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid token", retry: false } },
      403,
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { code: "INVALID_MESSAGE", message: "Invalid JSON body", retry: false } },
      400,
    );
  }

  const parsed = AgentCardSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "INVALID_MESSAGE",
          message: `Validation failed: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
          retry: false,
        },
      },
      400,
    );
  }

  const card = parsed.data;
  card.agent_id = id;

  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  putAgent({
    card: card as any,
    registered_at: stored.registered_at,
    expires_at: expires.toISOString(),
    token_hash: stored.token_hash,
  });

  return c.json({ agent_id: id, expires_at: expires.toISOString() });
});

// ── Delete agent ────────────────────────────────────────

app.delete("/v1/agents/:id", (c) => {
  const id = c.req.param("id");
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Missing bearer token", retry: false } },
      401,
    );
  }

  const token = authHeader.slice(7);
  const stored = getAgent(id);

  if (!stored) {
    return c.json(
      { error: { code: "AGENT_UNAVAILABLE", message: "Agent not found", retry: false } },
      404,
    );
  }

  if (stored.token_hash !== hashToken(token)) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid token", retry: false } },
      403,
    );
  }

  deleteAgent(id);
  return c.body(null, 204);
});

// ── Message relay: send ─────────────────────────────────

app.post("/v1/relay", async (c) => {
  const auth = resolveAgent(c.req.header("Authorization"));
  if (!auth) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Must be a registered agent to send messages", retry: false } },
      401,
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { code: "INVALID_MESSAGE", message: "Invalid JSON body", retry: false } },
      400,
    );
  }

  const parsed = MessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "INVALID_MESSAGE",
          message: `Invalid message: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
          retry: false,
        },
      },
      400,
    );
  }

  const msg = parsed.data;

  // Verify sender matches token
  if (msg.from !== auth.agentId) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Token does not match sender", retry: false } },
      403,
    );
  }

  // Verify recipient exists
  const recipient = getAgent(msg.to);
  if (!recipient) {
    return c.json(
      { error: { code: "AGENT_UNAVAILABLE", message: "Recipient agent not found", retry: false } },
      404,
    );
  }

  // Store for delivery
  const relayId = generateId("relay_");
  storeMessage({
    id: relayId,
    conversation_id: msg.conversation_id,
    from_agent: msg.from,
    to_agent: msg.to,
    intent: msg.intent,
    message_json: JSON.stringify(body),
  });

  return c.json({ relay_id: relayId, status: "queued" }, 201);
});

// ── Message relay: poll ─────────────────────────────────

app.get("/v1/relay", (c) => {
  const auth = resolveAgent(c.req.header("Authorization"));
  if (!auth) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Must be a registered agent to poll messages", retry: false } },
      401,
    );
  }

  const conversation = c.req.query("conversation");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 100);

  const rows = conversation
    ? getMessagesInConversation(conversation, auth.agentId, limit)
    : getMessagesFor(auth.agentId, limit);

  const messages = rows.map((row) => ({
    relay_id: row.id,
    message: JSON.parse(row.message_json),
    created_at: row.created_at,
  }));

  return c.json({ messages });
});

// ── Message relay: acknowledge ──────────────────────────

app.post("/v1/relay/:id/ack", (c) => {
  const auth = resolveAgent(c.req.header("Authorization"));
  if (!auth) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized", retry: false } },
      401,
    );
  }

  const relayId = c.req.param("id");
  const acked = ackMessage(relayId, auth.agentId);

  if (!acked) {
    return c.json(
      { error: { code: "INVALID_MESSAGE", message: "Message not found or already acknowledged", retry: false } },
      404,
    );
  }

  return c.json({ status: "acknowledged" });
});

// ── Start server ────────────────────────────────────────

const port = parseInt(process.env.PORT ?? "3141", 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Squad Klaw Directory running on http://localhost:${port}`);
});

export { app };
