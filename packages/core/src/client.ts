import type { AgentCard, Message, MessageResponse, ErrorResponse } from "./types.js";
import { MessageSchema, AgentCardSchema, DirectoryQuerySchema } from "./schema.js";
import { signMessage, verifyMessage, messageId, conversationId } from "./crypto.js";

export interface AgentMeshClientOptions {
  /** This agent's card */
  agentCard: AgentCard;
  /** This agent's private key (PEM) */
  privateKey: string;
  /** Directory base URL (default: https://directory.agentmesh.dev/v1) */
  directoryUrl?: string;
}

export class AgentMeshClient {
  private agentCard: AgentCard;
  private privateKey: string;
  private directoryUrl: string;

  constructor(options: AgentMeshClientOptions) {
    this.agentCard = options.agentCard;
    this.privateKey = options.privateKey;
    this.directoryUrl =
      options.directoryUrl ?? "https://directory.agentmesh.dev/v1";
  }

  /**
   * Register this agent in the directory.
   */
  async register(token: string): Promise<{ agent_id: string; expires_at: string }> {
    const res = await fetch(`${this.directoryUrl}/agents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(this.agentCard),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new AgentMeshError(`Registration failed: ${err.error?.message ?? res.statusText}`, err);
    }

    return res.json();
  }

  /**
   * Discover agents by capability, intent, or free-text search.
   */
  async discover(query: {
    capability?: string;
    intent?: string;
    q?: string;
    limit?: number;
  }): Promise<{ agents: AgentCard[]; cursor?: string }> {
    const params = new URLSearchParams();
    if (query.capability) params.set("capability", query.capability);
    if (query.intent) params.set("intent", query.intent);
    if (query.q) params.set("q", query.q);
    if (query.limit) params.set("limit", String(query.limit));

    const res = await fetch(`${this.directoryUrl}/agents?${params}`);
    if (!res.ok) {
      throw new AgentMeshError(`Discovery failed: ${res.statusText}`);
    }

    return res.json();
  }

  /**
   * Look up an agent by ID.
   */
  async getAgent(agentId: string): Promise<AgentCard> {
    const res = await fetch(`${this.directoryUrl}/agents/${agentId}`);
    if (!res.ok) {
      throw new AgentMeshError(`Agent lookup failed: ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * Send a message to another agent.
   */
  async send(
    to: AgentCard,
    intent: string,
    payload: Record<string, unknown>,
    existingConversationId?: string
  ): Promise<MessageResponse | ErrorResponse> {
    const message: Omit<Message, "signature"> & { signature?: string } = {
      agentmesh: "0.1.0",
      message_id: messageId(),
      conversation_id: existingConversationId ?? conversationId(),
      from: this.agentCard.agent_id,
      to: to.agent_id,
      timestamp: new Date().toISOString(),
      intent,
      payload,
    };

    // Sign the message
    const signature = signMessage(message as Record<string, unknown>, this.privateKey);
    const signed: Message = { ...message, signature } as Message;

    // Validate before sending
    MessageSchema.parse(signed);

    const res = await fetch(to.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signed),
    });

    const body = await res.json();

    if (!res.ok) {
      return body as ErrorResponse;
    }

    return body as MessageResponse;
  }

  /**
   * Verify an incoming message's signature.
   */
  async verifyIncoming(message: Message): Promise<boolean> {
    // Look up the sender's agent card to get their public key
    const sender = await this.getAgent(message.from);
    return verifyMessage(
      message as unknown as Record<string, unknown>,
      message.signature,
      sender.public_key
    );
  }
}

export class AgentMeshError extends Error {
  public details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "AgentMeshError";
    this.details = details;
  }
}
