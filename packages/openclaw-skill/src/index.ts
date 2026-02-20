import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  AgentMeshClient,
  generateKeyPair,
  agentId,
  STANDARD_INTENTS,
  type AgentCard,
  type KeyPair,
} from "@agentmesh/core";

const CONFIG_DIR = join(homedir(), ".agentmesh");
const CARD_PATH = join(CONFIG_DIR, "agent-card.json");
const KEY_PATH = join(CONFIG_DIR, "keypair.json");

export interface SkillConfig {
  /** Agent display name */
  name: string;
  /** Agent description */
  description?: string;
  /** Owner info */
  owner?: { name: string; contact?: string };
  /** Public HTTPS endpoint where this agent receives messages */
  endpoint: string;
  /** Capabilities to advertise */
  capabilities?: string[];
  /** Directory server URL */
  directoryUrl?: string;
}

/**
 * Initialize AgentMesh for this OpenClaw instance.
 * Generates keys, creates an agent card, and saves config.
 */
export function init(config: SkillConfig): { card: AgentCard; keys: KeyPair } {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  // Generate or load keypair
  let keys: KeyPair;
  if (existsSync(KEY_PATH)) {
    keys = JSON.parse(readFileSync(KEY_PATH, "utf-8"));
  } else {
    keys = generateKeyPair();
    writeFileSync(KEY_PATH, JSON.stringify(keys, null, 2), { mode: 0o600 });
  }

  // Build agent card
  const card: AgentCard = {
    agentmesh: "0.1.0",
    agent_id: agentId(),
    name: config.name,
    description: config.description,
    owner: config.owner,
    endpoint: config.endpoint,
    public_key: keys.publicKey,
    capabilities: config.capabilities ?? [
      "scheduling",
      "communication",
      "research",
    ],
    intents: [
      STANDARD_INTENTS.SCHEDULE,
      STANDARD_INTENTS.MESSAGE,
      STANDARD_INTENTS.REQUEST_INFO,
      STANDARD_INTENTS.HANDOFF,
    ],
    access_control: {
      mode: "approval",
    },
  };

  // Load existing card if present (preserve agent_id)
  if (existsSync(CARD_PATH)) {
    const existing = JSON.parse(readFileSync(CARD_PATH, "utf-8"));
    card.agent_id = existing.agent_id;
  }

  writeFileSync(CARD_PATH, JSON.stringify(card, null, 2));

  return { card, keys };
}

/**
 * Create a connected AgentMesh client from saved config.
 */
export function connect(directoryUrl?: string): AgentMeshClient {
  if (!existsSync(CARD_PATH) || !existsSync(KEY_PATH)) {
    throw new Error(
      "AgentMesh not initialized. Run `openclaw skills add agentmesh` first."
    );
  }

  const card: AgentCard = JSON.parse(readFileSync(CARD_PATH, "utf-8"));
  const keys: KeyPair = JSON.parse(readFileSync(KEY_PATH, "utf-8"));

  return new AgentMeshClient({
    agentCard: card,
    privateKey: keys.privateKey,
    directoryUrl,
  });
}

/**
 * Get the local agent card.
 */
export function getCard(): AgentCard | null {
  if (!existsSync(CARD_PATH)) return null;
  return JSON.parse(readFileSync(CARD_PATH, "utf-8"));
}
