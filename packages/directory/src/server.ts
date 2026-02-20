import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { AgentCardSchema, DirectoryQuerySchema, agentId } from "@squadklaw/core";
import { AgentStore } from "./store.js";
import type { StoredAgent } from "./store.js";
import { createHash, randomBytes } from "node:crypto";

const app = new Hono();
const store = new AgentStore();

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Health check
app.get("/", (c) => {
  return c.json({
    name: "Squad Klaw Directory",
    version: "0.1.0",
    agents: store.count(),
  });
});

// Register an agent
app.post("/v1/agents", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Missing bearer token", retry: false } },
      401
    );
  }

  const token = authHeader.slice(7);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { code: "INVALID_MESSAGE", message: "Invalid JSON body", retry: false } },
      400
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
      400
    );
  }

  const card = parsed.data;

  // Assign server-generated agent_id if not provided or override
  const id = agentId();
  card.agent_id = id;

  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const stored: StoredAgent = {
    card: card as any,
    registered_at: now.toISOString(),
    expires_at: expires.toISOString(),
    token_hash: hashToken(token),
  };

  store.put(stored);

  return c.json(
    {
      agent_id: id,
      registered_at: stored.registered_at,
      expires_at: stored.expires_at,
    },
    201
  );
});

// Discover agents
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
      400
    );
  }

  const results = store.search(parsed.data);
  return c.json(results);
});

// Get agent by ID
app.get("/v1/agents/:id", (c) => {
  const id = c.req.param("id");
  const stored = store.get(id);

  if (!stored) {
    return c.json(
      { error: { code: "AGENT_UNAVAILABLE", message: "Agent not found", retry: false } },
      404
    );
  }

  return c.json(stored.card);
});

// Update agent registration
app.put("/v1/agents/:id", async (c) => {
  const id = c.req.param("id");
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Missing bearer token", retry: false } },
      401
    );
  }

  const token = authHeader.slice(7);
  const stored = store.get(id);

  if (!stored) {
    return c.json(
      { error: { code: "AGENT_UNAVAILABLE", message: "Agent not found", retry: false } },
      404
    );
  }

  if (stored.token_hash !== hashToken(token)) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid token", retry: false } },
      403
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { code: "INVALID_MESSAGE", message: "Invalid JSON body", retry: false } },
      400
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
      400
    );
  }

  const card = parsed.data;
  card.agent_id = id; // Preserve original ID

  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  store.put({
    card: card as any,
    registered_at: stored.registered_at,
    expires_at: expires.toISOString(),
    token_hash: stored.token_hash,
  });

  return c.json({ agent_id: id, expires_at: expires.toISOString() });
});

// Deregister agent
app.delete("/v1/agents/:id", (c) => {
  const id = c.req.param("id");
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Missing bearer token", retry: false } },
      401
    );
  }

  const token = authHeader.slice(7);
  const stored = store.get(id);

  if (!stored) {
    return c.json(
      { error: { code: "AGENT_UNAVAILABLE", message: "Agent not found", retry: false } },
      404
    );
  }

  if (stored.token_hash !== hashToken(token)) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid token", retry: false } },
      403
    );
  }

  store.delete(id);
  return c.body(null, 204);
});

// Start server
const port = parseInt(process.env.PORT ?? "3141", 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Squad Klaw Directory running on http://localhost:${port}`);
});

export { app };
