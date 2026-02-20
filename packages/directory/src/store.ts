import type { AgentCard } from "@squadklaw/core";
import { getDb } from "./db.js";

export interface StoredAgent {
  card: AgentCard;
  registered_at: string;
  expires_at: string;
  token_hash: string;
}

export interface StoredMessage {
  id: string;
  conversation_id: string;
  from_agent: string;
  to_agent: string;
  intent: string;
  message_json: string;
  created_at: string;
  delivered: number;
}

// ── Agent operations ────────────────────────────────────

export function putAgent(agent: StoredAgent): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO agents (agent_id, card_json, token_hash, registered_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    agent.card.agent_id,
    JSON.stringify(agent.card),
    agent.token_hash,
    agent.registered_at,
    agent.expires_at,
  );
}

export function getAgent(agentId: string): StoredAgent | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM agents WHERE agent_id = ?").get(agentId) as any;
  if (!row) return undefined;
  return {
    card: JSON.parse(row.card_json),
    registered_at: row.registered_at,
    expires_at: row.expires_at,
    token_hash: row.token_hash,
  };
}

export function deleteAgent(agentId: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM agents WHERE agent_id = ?").run(agentId);
  return result.changes > 0;
}

export function searchAgents(query: {
  capability?: string;
  intent?: string;
  q?: string;
  limit: number;
  cursor?: string;
}): { agents: AgentCard[]; cursor?: string } {
  const db = getDb();
  let results: AgentCard[] = db
    .prepare("SELECT card_json FROM agents ORDER BY agent_id")
    .all()
    .map((row: any) => JSON.parse(row.card_json));

  if (query.capability) {
    results = results.filter((a) => a.capabilities.includes(query.capability!));
  }

  if (query.intent) {
    results = results.filter((a) => a.intents.includes(query.intent!));
  }

  if (query.q) {
    const q = query.q.toLowerCase();
    results = results.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q),
    );
  }

  if (query.cursor) {
    const decoded = Buffer.from(query.cursor, "base64").toString();
    const idx = results.findIndex((a) => a.agent_id === decoded);
    if (idx !== -1) {
      results = results.slice(idx + 1);
    }
  }

  const page = results.slice(0, query.limit);
  const nextCursor =
    page.length === query.limit
      ? Buffer.from(page[page.length - 1].agent_id).toString("base64")
      : undefined;

  return { agents: page, cursor: nextCursor };
}

export function countAgents(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM agents").get() as any;
  return row.count;
}

export function getAgentByTokenHash(tokenHash: string): StoredAgent | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM agents WHERE token_hash = ?").get(tokenHash) as any;
  if (!row) return undefined;
  return {
    card: JSON.parse(row.card_json),
    registered_at: row.registered_at,
    expires_at: row.expires_at,
    token_hash: row.token_hash,
  };
}

// ── Message relay operations ────────────────────────────

export function storeMessage(msg: {
  id: string;
  conversation_id: string;
  from_agent: string;
  to_agent: string;
  intent: string;
  message_json: string;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO messages (id, conversation_id, from_agent, to_agent, intent, message_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(msg.id, msg.conversation_id, msg.from_agent, msg.to_agent, msg.intent, msg.message_json);
}

export function getMessagesFor(agentId: string, limit = 50): StoredMessage[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM messages WHERE to_agent = ? AND delivered = 0 ORDER BY created_at ASC LIMIT ?")
    .all(agentId, limit) as StoredMessage[];
}

export function getMessagesInConversation(conversationId: string, agentId: string, limit = 50): StoredMessage[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM messages WHERE conversation_id = ? AND to_agent = ? AND delivered = 0 ORDER BY created_at ASC LIMIT ?")
    .all(conversationId, agentId, limit) as StoredMessage[];
}

export function ackMessage(messageId: string, agentId: string): boolean {
  const db = getDb();
  const result = db
    .prepare("UPDATE messages SET delivered = 1 WHERE id = ? AND to_agent = ?")
    .run(messageId, agentId);
  return result.changes > 0;
}

export function ackAllMessages(agentId: string): number {
  const db = getDb();
  const result = db
    .prepare("UPDATE messages SET delivered = 1 WHERE to_agent = ? AND delivered = 0")
    .run(agentId);
  return result.changes;
}
