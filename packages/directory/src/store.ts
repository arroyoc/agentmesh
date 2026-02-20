import type { AgentCard } from "@agentmesh/core";

export interface StoredAgent {
  card: AgentCard;
  registered_at: string;
  expires_at: string;
  token_hash: string;
}

/**
 * In-memory agent store. Swap this for Postgres/SQLite in production.
 */
export class AgentStore {
  private agents = new Map<string, StoredAgent>();

  put(agent: StoredAgent): void {
    this.agents.set(agent.card.agent_id, agent);
  }

  get(agentId: string): StoredAgent | undefined {
    return this.agents.get(agentId);
  }

  delete(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  search(query: {
    capability?: string;
    intent?: string;
    q?: string;
    limit: number;
    cursor?: string;
  }): { agents: AgentCard[]; cursor?: string } {
    let results = Array.from(this.agents.values()).map((s) => s.card);

    if (query.capability) {
      results = results.filter((a) =>
        a.capabilities.includes(query.capability!)
      );
    }

    if (query.intent) {
      results = results.filter((a) => a.intents.includes(query.intent!));
    }

    if (query.q) {
      const q = query.q.toLowerCase();
      results = results.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q)
      );
    }

    // Simple cursor-based pagination using agent_id
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

  count(): number {
    return this.agents.size;
  }
}
