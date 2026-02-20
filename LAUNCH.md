# Launch Playbook

## 1. Hacker News Post

**Title:** Show HN: AgentMesh – An open protocol for agent-to-agent communication

**Text:**
Hey HN — I built AgentMesh, an open protocol that lets AI agents discover each other and communicate.

The problem: tools like OpenClaw give you a powerful personal AI agent, but every agent is an island. Your agent can manage your calendar, send emails, and automate workflows — but it can't talk to anyone else's agent.

AgentMesh is three things:

1. **Agent Cards** — a JSON format for agents to describe themselves (capabilities, endpoint, public key)
2. **A Directory** — a REST API where agents register and discover each other
3. **Signed Messages** — Ed25519-signed JSON messages with standardized intents (scheduling, negotiation, info requests)

Think SMTP for AI agents.

The demo in the repo shows two agents negotiating a coffee meeting — proposing times, counter-offering on duration and location, and accepting — in 3 messages with zero human involvement.

Everything is open source (AGPL-3.0, spec is CC-BY-SA). Built as a monorepo with a core SDK, a Hono-based directory server, and an OpenClaw plugin.

The protocol is intentionally simple — JSON over HTTPS, 4 REST endpoints, 5 standard intents. I wanted something anyone could implement in a weekend.

GitHub: https://github.com/arroyoc/agentmesh
Spec: https://github.com/arroyoc/agentmesh/blob/main/SPEC.md

Would love feedback on the protocol design. What intents are missing? What would you want your agent to negotiate with other agents?

---

## 2. Twitter/X Thread

**Tweet 1 (hook):**
Your AI agent is powerful. But it's alone.

I just open-sourced AgentMesh — the protocol that lets AI agents talk to each other.

Think SMTP, but for AI agents.

Thread:

**Tweet 2 (problem):**
68,000+ people run personal AI agents with OpenClaw. Each agent can manage calendars, send emails, automate workflows.

But none of them can talk to each other.

Want your agent to schedule coffee with a friend? It can't reach their agent. That's broken.

**Tweet 3 (solution):**
AgentMesh fixes this with 3 concepts:

- Agent Cards (JSON business cards for AI)
- A Directory (find agents by capability)
- Signed Messages (Ed25519, multi-turn conversations)

That's the whole protocol.

**Tweet 4 (demo):**
Here's two agents scheduling a coffee meeting with zero human involvement:

[attach screenshot/video of demo output]

3 messages. Propose → Counter → Accept. Both calendars updated. Done.

**Tweet 5 (technical):**
The protocol is intentionally minimal:
- JSON over HTTPS
- 4 REST endpoints
- 5 standard intents (schedule, message, negotiate, request_info, handoff)
- Ed25519 message signing
- Consent model (open/allowlist/approval)

Anyone can implement it in a weekend.

**Tweet 6 (open source):**
Fully open source:
- Protocol spec: CC-BY-SA 4.0
- Reference code: AGPL-3.0
- No vendor lock-in
- Framework agnostic (built for OpenClaw, works with anything)

**Tweet 7 (CTA):**
The agent economy needs a protocol. This is it.

GitHub: https://github.com/arroyoc/agentmesh

Star it, fork it, build on it. PRs and protocol feedback welcome.

---

## 3. OpenClaw Community Post (Discord/Reddit)

**Title:** AgentMesh — let your OpenClaw agent talk to other agents

Hey everyone — I built an open protocol that lets OpenClaw agents communicate with each other.

Right now your agent is incredibly powerful but isolated. AgentMesh adds agent-to-agent discovery and messaging so your agent can:

- Schedule meetings by talking to your friend's agent
- Send messages through agent-to-agent channels
- Negotiate with business agents (pricing, terms, etc.)
- Request info from other agents

It ships as an OpenClaw skill (`openclaw skills add agentmesh`) and the protocol is fully open source.

Demo in the repo shows two agents negotiating a coffee meeting end-to-end.

GitHub: https://github.com/arroyoc/agentmesh

Looking for early adopters to test agent-to-agent scheduling. If you want to try connecting your agent, drop a comment.

---

## 4. Action Items

- [ ] Enable GitHub Pages in repo settings (Settings → Pages → Source: GitHub Actions)
- [ ] Buy domain: agentmesh.dev (Cloudflare or Namecheap)
- [ ] Post on HN (Tuesday or Wednesday morning, 8-9 AM ET is peak)
- [ ] Post Twitter thread (same morning)
- [ ] Post in OpenClaw Discord
- [ ] Post on r/OpenClaw, r/artificial, r/LocalLLaMA
- [ ] Record a 30-second terminal demo video (asciinema or screen recording)
