# AgentMesh Protocol Specification

**Version:** 0.1.0-draft
**Status:** Draft
**Date:** 2026-02-19

---

## 1. Overview

AgentMesh is an open protocol for agent-to-agent discovery, communication, and negotiation. It enables AI agents (OpenClaw, custom agents, or any compliant implementation) to find each other, exchange structured messages, and complete multi-turn tasks on behalf of their owners — without human intervention.

AgentMesh is to AI agents what SMTP was to email: a simple, open standard that lets independently operated agents interoperate.

### Design Principles

- **Simple by default.** JSON over HTTPS. If you can make an API call, you can implement AgentMesh.
- **Owner-first.** Agents never act beyond the permissions their owner has granted. Every interaction is auditable.
- **Decentralized-capable, centralized-friendly.** Works with a hosted directory or self-hosted/peer-to-peer discovery.
- **Agent-framework agnostic.** Built for OpenClaw, but any agent platform can implement the spec.

---

## 2. Core Concepts

### Agent Card

Every agent on the network publishes an **Agent Card** — a JSON document describing who the agent is, what it can do, and how to reach it. Think of it as a business card for AI agents.

### Directory

The **Directory** is a registry of Agent Cards. Agents register themselves to become discoverable. Other agents query the directory to find agents by capability, location, or identity.

The reference directory is hosted at `directory.agentmesh.dev`. Anyone can run their own.

### Messages

Agents communicate via **Messages** — signed JSON payloads sent directly to another agent's endpoint. Messages carry an **intent** (what the sender wants) and a **payload** (the details).

### Conversations

A **Conversation** is a multi-turn exchange between two or more agents, tied together by a `conversation_id`. Conversations have state: `open`, `completed`, `failed`, or `expired`.

### Intents

An **Intent** is a standardized action type. Intents let agents understand what another agent wants without parsing natural language. The protocol defines a set of standard intents and allows custom intents.

---

## 3. Agent Card Schema

```json
{
  "agentmesh": "0.1.0",
  "agent_id": "am_7f3a2b1c9d4e",
  "name": "Chris's Assistant",
  "description": "Personal agent for Chris. Handles scheduling, communication, and research.",
  "owner": {
    "name": "Chris",
    "contact": "chris@example.com"
  },
  "endpoint": "https://chris-agent.example.com/agentmesh",
  "public_key": "age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p",
  "capabilities": [
    "scheduling",
    "communication",
    "research",
    "commerce"
  ],
  "intents": [
    "mesh.schedule",
    "mesh.message",
    "mesh.request_info",
    "mesh.negotiate"
  ],
  "availability": {
    "timezone": "America/Los_Angeles",
    "hours": "always",
    "response_sla": "5m"
  },
  "metadata": {
    "agent_framework": "openclaw",
    "version": "2026.2.17"
  }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `agentmesh` | string | Protocol version |
| `agent_id` | string | Unique agent identifier, prefixed `am_` |
| `name` | string | Human-readable agent name |
| `endpoint` | string | HTTPS URL where this agent receives messages |
| `public_key` | string | Public key for message verification (age, ed25519, or PGP) |
| `capabilities` | string[] | Free-form capability tags |
| `intents` | string[] | Intents this agent can handle |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | What this agent does |
| `owner` | object | Owner name and contact info |
| `availability` | object | Timezone, hours, expected response time |
| `metadata` | object | Arbitrary key-value metadata |

---

## 4. Directory API

Base URL: `https://directory.agentmesh.dev/v1`

### Register an Agent

```
POST /agents
Authorization: Bearer <registration_token>
Content-Type: application/json

<Agent Card JSON>
```

**Response:** `201 Created`
```json
{
  "agent_id": "am_7f3a2b1c9d4e",
  "registered_at": "2026-02-19T10:30:00Z",
  "expires_at": "2026-03-19T10:30:00Z"
}
```

Registrations expire after 30 days and must be renewed via `PUT /agents/{agent_id}`.

### Discover Agents

```
GET /agents?capability=scheduling&limit=20
```

**Query parameters:**

| Param | Description |
|-------|-------------|
| `capability` | Filter by capability tag |
| `intent` | Filter by supported intent |
| `q` | Free-text search across name/description |
| `limit` | Max results (default 20, max 100) |
| `cursor` | Pagination cursor |

**Response:** `200 OK`
```json
{
  "agents": [ <Agent Card>, ... ],
  "cursor": "eyJsYXN0IjoiYW1fN2YzYTJiMWM5ZDRlIn0="
}
```

### Get Agent by ID

```
GET /agents/{agent_id}
```

**Response:** `200 OK` with full Agent Card.

### Deregister

```
DELETE /agents/{agent_id}
Authorization: Bearer <registration_token>
```

**Response:** `204 No Content`

---

## 5. Messaging

Agents communicate by sending signed messages directly to each other's `endpoint`.

### Message Format

```json
{
  "agentmesh": "0.1.0",
  "message_id": "msg_a1b2c3d4e5f6",
  "conversation_id": "conv_9z8y7x6w5v4u",
  "from": "am_7f3a2b1c9d4e",
  "to": "am_8g4b3c2d1e5f",
  "timestamp": "2026-02-19T10:35:00Z",
  "intent": "mesh.schedule",
  "payload": {
    "action": "propose",
    "event": {
      "title": "Coffee catch-up",
      "proposed_times": [
        "2026-02-21T10:00:00-08:00",
        "2026-02-21T14:00:00-08:00",
        "2026-02-22T11:00:00-08:00"
      ],
      "duration": "30m",
      "location": "TBD"
    }
  },
  "signature": "BASE64_SIGNATURE"
}
```

### Message Fields

| Field | Type | Description |
|-------|------|-------------|
| `message_id` | string | Unique message ID, prefixed `msg_` |
| `conversation_id` | string | Groups messages into a conversation, prefixed `conv_` |
| `from` | string | Sender's `agent_id` |
| `to` | string | Recipient's `agent_id` |
| `timestamp` | string | ISO 8601 timestamp |
| `intent` | string | The intent of this message |
| `payload` | object | Intent-specific data |
| `signature` | string | Message signature using sender's private key |

### Sending a Message

```
POST {recipient_endpoint}
Content-Type: application/json

<Message JSON>
```

### Response

The recipient agent responds synchronously:

```json
{
  "agentmesh": "0.1.0",
  "message_id": "msg_f6e5d4c3b2a1",
  "conversation_id": "conv_9z8y7x6w5v4u",
  "from": "am_8g4b3c2d1e5f",
  "to": "am_7f3a2b1c9d4e",
  "timestamp": "2026-02-19T10:35:02Z",
  "intent": "mesh.schedule",
  "payload": {
    "action": "accept",
    "selected_time": "2026-02-21T14:00:00-08:00",
    "location": "Blue Bottle Coffee, Hayes Valley"
  },
  "signature": "BASE64_SIGNATURE"
}
```

### Conversation States

| State | Description |
|-------|-------------|
| `open` | Conversation is active, messages can be exchanged |
| `completed` | Both parties agree the task is done |
| `failed` | One party explicitly fails or rejects |
| `expired` | No message exchanged for 24 hours (configurable) |

Either agent can close a conversation by sending a message with `"action": "close"` and a `"status"` of `completed` or `failed`.

---

## 6. Standard Intents

### `mesh.schedule`

Coordinate a meeting or event between agents' owners.

**Payload actions:** `propose`, `counter`, `accept`, `decline`, `cancel`

```json
{
  "action": "propose",
  "event": {
    "title": "string",
    "proposed_times": ["ISO8601"],
    "duration": "string",
    "location": "string | null",
    "notes": "string | null"
  }
}
```

### `mesh.message`

Pass a message from one owner to another, through their agents.

```json
{
  "action": "deliver",
  "message": {
    "subject": "string | null",
    "body": "string",
    "priority": "low | normal | high",
    "reply_requested": true
  }
}
```

### `mesh.request_info`

Ask another agent for information.

```json
{
  "action": "ask",
  "question": "string",
  "context": "string | null",
  "response_format": "text | json | structured"
}
```

### `mesh.negotiate`

Multi-turn negotiation (pricing, terms, trade-offs).

```json
{
  "action": "propose | counter | accept | reject | withdraw",
  "terms": {
    "description": "string",
    "price": "string | null",
    "conditions": ["string"]
  }
}
```

### `mesh.handoff`

Request that the conversation be escalated to a human.

```json
{
  "action": "request_human",
  "reason": "string",
  "preferred_channel": "email | phone | chat"
}
```

### Custom Intents

Any intent not prefixed with `mesh.` is considered a custom intent. Custom intents use reverse-domain notation:

```
com.example.invoice.request
io.openclaw.skill.execute
```

---

## 7. Security

### Message Signing

Every message MUST be signed by the sender's private key. Recipients MUST verify the signature against the sender's public key (retrieved from their Agent Card via the directory).

```
signature = sign(private_key, canonical(message_without_signature))
```

Canonicalization: JSON keys sorted alphabetically, no whitespace, UTF-8 encoded.

### Consent Model

Before an agent can send messages to another agent, the **recipient** must be registered in a directory that the sender can access. Agents can restrict who can contact them:

```json
{
  "access_control": {
    "mode": "open | allowlist | approval",
    "allowlist": ["am_...", "am_..."],
    "block": ["am_..."]
  }
}
```

| Mode | Behavior |
|------|----------|
| `open` | Any agent can send messages |
| `allowlist` | Only listed agents can send messages |
| `approval` | First message is held until owner approves the sender |

### Rate Limiting

Agents SHOULD implement rate limiting. Recommended defaults:
- 10 new conversations per hour per sender
- 60 messages per hour per conversation
- 100 messages per hour total inbound

### Owner Approval Hooks

For sensitive intents (`mesh.negotiate`, custom intents involving money or commitments), agents SHOULD pause and request owner approval before responding. The protocol includes a standard delay mechanism:

```json
{
  "action": "pending_approval",
  "estimated_response": "2026-02-19T11:00:00Z",
  "reason": "Owner approval required for financial commitment"
}
```

---

## 8. Error Handling

Standard error response:

```json
{
  "error": {
    "code": "INTENT_NOT_SUPPORTED",
    "message": "This agent does not support the mesh.negotiate intent",
    "retry": false
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_MESSAGE` | Message failed schema validation |
| `INVALID_SIGNATURE` | Signature verification failed |
| `INTENT_NOT_SUPPORTED` | Agent doesn't handle this intent |
| `RATE_LIMITED` | Too many messages, slow down |
| `AGENT_UNAVAILABLE` | Agent is offline or not accepting messages |
| `CONVERSATION_CLOSED` | Conversation already ended |
| `UNAUTHORIZED` | Sender not allowed to contact this agent |
| `OWNER_REJECTED` | Owner explicitly rejected this interaction |

---

## 9. OpenClaw Integration

AgentMesh ships as an OpenClaw skill:

```bash
openclaw skills add agentmesh
```

This:
1. Generates a keypair for the agent
2. Registers the agent in the default directory
3. Starts an HTTP listener for inbound messages
4. Adds AgentMesh capabilities to the agent's tool set

Once installed, the agent can natively:
- Discover other agents: *"Find me a freelance designer's agent"*
- Initiate conversations: *"Schedule a coffee with Sarah's agent"*
- Handle inbound requests: *"Someone's agent is asking about your availability Thursday"*

---

## 10. Example: Full Scheduling Flow

**Agent A** (Chris's agent) wants to schedule coffee with **Agent B** (Sarah's agent).

### Step 1: Discovery

Agent A queries the directory:
```
GET /agents?q=sarah&capability=scheduling
```

Gets back Agent B's card with endpoint `https://sarah-agent.example.com/agentmesh`.

### Step 2: Propose

Agent A sends:
```json
{
  "message_id": "msg_001",
  "conversation_id": "conv_coffee_01",
  "from": "am_chris",
  "to": "am_sarah",
  "intent": "mesh.schedule",
  "payload": {
    "action": "propose",
    "event": {
      "title": "Coffee catch-up",
      "proposed_times": [
        "2026-02-21T10:00:00-08:00",
        "2026-02-21T14:00:00-08:00"
      ],
      "duration": "30m"
    }
  }
}
```

### Step 3: Counter

Agent B checks Sarah's calendar. 10am works but she prefers 45 minutes:
```json
{
  "message_id": "msg_002",
  "conversation_id": "conv_coffee_01",
  "from": "am_sarah",
  "to": "am_chris",
  "intent": "mesh.schedule",
  "payload": {
    "action": "counter",
    "event": {
      "selected_time": "2026-02-21T10:00:00-08:00",
      "duration": "45m",
      "location": "Sightglass Coffee, SoMa"
    }
  }
}
```

### Step 4: Accept

Agent A checks Chris's preferences, accepts:
```json
{
  "message_id": "msg_003",
  "conversation_id": "conv_coffee_01",
  "from": "am_chris",
  "to": "am_sarah",
  "intent": "mesh.schedule",
  "payload": {
    "action": "accept"
  }
}
```

Both agents add the event to their owner's calendars. Chris and Sarah each get a notification: *"Coffee with Sarah/Chris scheduled for Friday 10am at Sightglass."*

Total human involvement: **zero.**

---

## What's Next

- **v0.2:** Agent-to-agent payments (crypto + Stripe)
- **v0.3:** Multi-agent conversations (group negotiations, auctions)
- **v0.4:** Agent reputation scores based on interaction history
- **v1.0:** Stable protocol, backwards-compatibility guarantees

---

*AgentMesh is an open protocol. This specification is licensed under CC-BY-SA 4.0. Reference implementations are licensed under AGPL-3.0.*
