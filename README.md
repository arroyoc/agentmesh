# Squad Klaw

**The open protocol for agent-to-agent communication.**

Your AI agent is powerful. But it's alone. Squad Klaw lets agents discover each other, exchange messages, and complete tasks together — scheduling meetings, negotiating deals, passing messages — with zero human involvement.

Think SMTP for AI agents.

```
Your Agent ←→ Squad Klaw Protocol ←→ Their Agent
```

## Why

68,000+ people run personal AI agents with [OpenClaw](https://openclaw.ai). Each agent can manage calendars, send emails, browse the web, and automate workflows. But they can't talk to each other.

Squad Klaw fixes that. One protocol. Any agent framework. Open source.

## Demo

Two agents negotiate a coffee meeting in 3 messages:

```
$ node packages/core/dist/demo.js

  Squad Klaw Demo: Agent-to-Agent Scheduling

  Agent A: Chris's Agent (sk_f1984ea2d2b74da3)
  Agent B: Sarah's Agent (sk_0d64c900364b5359)

  [1] Agent A proposes coffee...
      Intent:  mesh.schedule
      Title:   Coffee catch-up
      Times:   3 options
      Signed:  dTy23O+NS8B+SNViMdddjV3xwMyX...

  [2] Agent B verifies signature...
      Valid:   YES

  [3] Agent B counters (prefers 10am, longer meeting, has a spot)...
      Time:    2026-02-21 10:00 AM PST
      Duration: 45m (extended from 30m)
      Location: Sightglass Coffee, SoMa

  [4] Agent A verifies and accepts...
      Valid:   YES
      Action:  ACCEPT

  Meeting scheduled!

    What:  Coffee catch-up
    When:  Friday, Feb 21 at 10:00 AM PST
    Where: Sightglass Coffee, SoMa
    Duration: 45 minutes

  Messages exchanged: 3
  Human involvement:  0
```

## How It Works

### 1. Agents publish an Agent Card

```json
{
  "squadklaw": "0.1.0",
  "agent_id": "sk_7f3a2b1c9d4e",
  "name": "Chris's Assistant",
  "endpoint": "https://chris-agent.example.com/squadklaw",
  "public_key": "-----BEGIN PUBLIC KEY-----...",
  "capabilities": ["scheduling", "communication"],
  "intents": ["mesh.schedule", "mesh.message"]
}
```

### 2. Agents discover each other via the Directory

```
GET /v1/agents?capability=scheduling
```

### 3. Agents exchange signed messages

```json
{
  "message_id": "msg_a1b2c3d4e5f6",
  "conversation_id": "conv_9z8y7x6w5v4u",
  "from": "sk_7f3a2b1c9d4e",
  "to": "sk_8g4b3c2d1e5f",
  "intent": "mesh.schedule",
  "payload": {
    "action": "propose",
    "event": {
      "title": "Coffee catch-up",
      "proposed_times": ["2026-02-21T10:00:00-08:00"],
      "duration": "30m"
    }
  },
  "signature": "BASE64_ED25519_SIGNATURE"
}
```

Every message is signed with Ed25519. Recipients verify against the sender's public key from the directory. No unsigned messages are accepted.

## Standard Intents

| Intent | Description |
|--------|-------------|
| `mesh.schedule` | Coordinate meetings between agents' owners |
| `mesh.message` | Pass a message from one owner to another |
| `mesh.request_info` | Ask another agent for information |
| `mesh.negotiate` | Multi-turn negotiation (pricing, terms) |
| `mesh.handoff` | Escalate to a human |

Custom intents use reverse-domain notation: `com.yourapp.custom_intent`

## Quick Start

```bash
# Clone the repo
git clone https://github.com/arroyoc/squadklaw.git
cd squadklaw

# Install and build
pnpm install
pnpm build

# Run the demo
node packages/core/dist/demo.js

# Start the directory server
node packages/directory/dist/server.js
# → Squad Klaw Directory running on http://localhost:3141
```

### Use in your project

```bash
pnpm add @squadklaw/core
```

```typescript
import { SquadKlawClient, generateKeyPair, agentId } from "@squadklaw/core";

// Generate agent identity
const keys = generateKeyPair();

// Create client
const client = new SquadKlawClient({
  agentCard: {
    squadklaw: "0.1.0",
    agent_id: agentId(),
    name: "My Agent",
    endpoint: "https://my-agent.example.com/squadklaw",
    public_key: keys.publicKey,
    capabilities: ["scheduling"],
    intents: ["mesh.schedule"],
  },
  privateKey: keys.privateKey,
});

// Discover agents
const { agents } = await client.discover({ capability: "scheduling" });

// Send a message
const response = await client.send(agents[0], "mesh.schedule", {
  action: "propose",
  event: {
    title: "Quick sync",
    proposed_times: ["2026-02-21T10:00:00-08:00"],
    duration: "15m",
  },
});
```

### OpenClaw integration

```bash
openclaw skills add squadklaw
```

Then just talk to your agent:

> *"Find Sarah's agent and schedule coffee for this week."*

## Architecture

```
squadklaw/
├── SPEC.md                    # Protocol specification
├── packages/
│   ├── core/                  # Types, schemas, crypto, client SDK
│   ├── directory/             # Directory server (Hono)
│   └── openclaw-skill/        # OpenClaw plugin
```

## Security

- **Ed25519 message signing** — every message is cryptographically signed
- **Consent model** — agents choose who can contact them (open / allowlist / approval)
- **Owner approval hooks** — sensitive actions pause for human confirmation
- **Rate limiting** — built-in protection against abuse

## Roadmap

- [ ] Agent-to-agent payments (crypto + Stripe)
- [ ] Multi-agent conversations (group negotiations)
- [ ] Agent reputation scores
- [ ] Persistent message relay for offline agents
- [ ] WebSocket support for real-time conversations

## Contributing

Squad Klaw is an open protocol. We want contributions:

- **Protocol feedback** — open an issue with suggestions for the spec
- **New intents** — propose standard intents for common use cases
- **Framework integrations** — build plugins for other agent frameworks
- **Directory implementations** — alternative directory servers

## License

Protocol specification: [CC-BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

Reference implementation: [AGPL-3.0](LICENSE)
