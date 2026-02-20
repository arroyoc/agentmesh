/**
 * Squad Klaw Demo: Two agents negotiate a coffee meeting.
 *
 * Run:
 *   node dist/demo.js
 *
 * This demo runs entirely locally — no directory server needed.
 * It simulates two agents discovering each other and scheduling
 * a meeting with zero human involvement.
 */

import {
  generateKeyPair,
  agentId,
  messageId,
  conversationId,
  signMessage,
  verifyMessage,
  STANDARD_INTENTS,
} from "./index.js";
import type { AgentCard, Message, ScheduleProposal, ScheduleCounter } from "./index.js";

// ── Setup ──────────────────────────────────────────────

console.log("\n  Squad Klaw Demo: Agent-to-Agent Scheduling\n");
console.log("  Two AI agents negotiate a coffee meeting.\n");
console.log("  ─".repeat(25) + "\n");

// Generate identities for two agents
const keysA = generateKeyPair();
const keysB = generateKeyPair();

const agentA: AgentCard = {
  squadklaw: "0.1.0",
  agent_id: agentId(),
  name: "Chris's Agent",
  description: "Personal assistant for Chris",
  endpoint: "https://chris-agent.local/squadklaw",
  public_key: keysA.publicKey,
  capabilities: ["scheduling", "communication"],
  intents: [STANDARD_INTENTS.SCHEDULE, STANDARD_INTENTS.MESSAGE],
};

const agentB: AgentCard = {
  squadklaw: "0.1.0",
  agent_id: agentId(),
  name: "Sarah's Agent",
  description: "Personal assistant for Sarah",
  endpoint: "https://sarah-agent.local/squadklaw",
  public_key: keysB.publicKey,
  capabilities: ["scheduling", "communication", "research"],
  intents: [STANDARD_INTENTS.SCHEDULE, STANDARD_INTENTS.MESSAGE],
};

console.log(`  Agent A: ${agentA.name} (${agentA.agent_id})`);
console.log(`  Agent B: ${agentB.name} (${agentB.agent_id})\n`);

// ── Step 1: Agent A proposes a meeting ─────────────────

console.log("  [1] Agent A proposes coffee...\n");

const convId = conversationId();

const proposal: Omit<Message, "signature"> = {
  squadklaw: "0.1.0",
  message_id: messageId(),
  conversation_id: convId,
  from: agentA.agent_id,
  to: agentB.agent_id,
  timestamp: new Date().toISOString(),
  intent: STANDARD_INTENTS.SCHEDULE,
  payload: {
    action: "propose",
    event: {
      title: "Coffee catch-up",
      proposed_times: [
        "2026-02-21T10:00:00-08:00",
        "2026-02-21T14:00:00-08:00",
        "2026-02-22T11:00:00-08:00",
      ],
      duration: "30m",
    },
  } satisfies ScheduleProposal,
};

const sig1 = signMessage(proposal as Record<string, unknown>, keysA.privateKey);
const signedProposal: Message = { ...proposal, signature: sig1 } as Message;

console.log(`      Intent:  ${signedProposal.intent}`);
console.log(`      Title:   ${(signedProposal.payload as any).event.title}`);
console.log(`      Times:   ${(signedProposal.payload as any).event.proposed_times.length} options`);
console.log(`      Signed:  ${sig1.slice(0, 32)}...`);

// ── Step 2: Agent B verifies and responds ──────────────

console.log("\n  [2] Agent B verifies signature...\n");

const verified = verifyMessage(
  signedProposal as unknown as Record<string, unknown>,
  signedProposal.signature,
  agentA.public_key
);

console.log(`      Valid:   ${verified ? "YES" : "FAILED"}`);

if (!verified) {
  console.log("\n  Signature verification failed. Aborting.\n");
  process.exit(1);
}

// ── Step 3: Agent B counters ───────────────────────────

console.log("\n  [3] Agent B counters (prefers 10am, longer meeting, has a spot)...\n");

const counter: Omit<Message, "signature"> = {
  squadklaw: "0.1.0",
  message_id: messageId(),
  conversation_id: convId,
  from: agentB.agent_id,
  to: agentA.agent_id,
  timestamp: new Date().toISOString(),
  intent: STANDARD_INTENTS.SCHEDULE,
  payload: {
    action: "counter",
    event: {
      selected_time: "2026-02-21T10:00:00-08:00",
      duration: "45m",
      location: "Sightglass Coffee, SoMa",
    },
  } satisfies ScheduleCounter,
};

const sig2 = signMessage(counter as Record<string, unknown>, keysB.privateKey);
const signedCounter: Message = { ...counter, signature: sig2 } as Message;

console.log(`      Time:    2026-02-21 10:00 AM PST`);
console.log(`      Duration: 45m (extended from 30m)`);
console.log(`      Location: Sightglass Coffee, SoMa`);
console.log(`      Signed:  ${sig2.slice(0, 32)}...`);

// ── Step 4: Agent A verifies and accepts ───────────────

console.log("\n  [4] Agent A verifies and accepts...\n");

const verified2 = verifyMessage(
  signedCounter as unknown as Record<string, unknown>,
  signedCounter.signature,
  agentB.public_key
);

console.log(`      Valid:   ${verified2 ? "YES" : "FAILED"}`);

const accept: Omit<Message, "signature"> = {
  squadklaw: "0.1.0",
  message_id: messageId(),
  conversation_id: convId,
  from: agentA.agent_id,
  to: agentB.agent_id,
  timestamp: new Date().toISOString(),
  intent: STANDARD_INTENTS.SCHEDULE,
  payload: {
    action: "accept",
  },
};

const sig3 = signMessage(accept as Record<string, unknown>, keysA.privateKey);

console.log(`      Action:  ACCEPT`);
console.log(`      Signed:  ${sig3.slice(0, 32)}...`);

// ── Done ───────────────────────────────────────────────

console.log("\n  ─".repeat(25));
console.log(`
  Meeting scheduled!

    What:  Coffee catch-up
    When:  Friday, Feb 21 at 10:00 AM PST
    Where: Sightglass Coffee, SoMa
    Duration: 45 minutes

  Messages exchanged: 3
  Human involvement:  0

  Both agents would now add this to their owner's calendar.
`);
