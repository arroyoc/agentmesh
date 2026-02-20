import chalk from "chalk";
import { createServer, type Server } from "node:http";
import {
  generateKeyPair,
  agentId,
  messageId,
  conversationId,
  signMessage,
  verifyMessage,
  MessageSchema,
} from "@squadklaw/core";
import type { AgentCard, Message } from "@squadklaw/core";
import { handleMessage } from "../handlers.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function dim(s: string) { return chalk.dim(s); }
function cyan(s: string) { return chalk.cyan(s); }
function yellow(s: string) { return chalk.yellow(s); }
function green(s: string) { return chalk.green(s); }
function bold(s: string) { return chalk.bold(s); }

export async function demoCommand() {
  console.log(bold("\n  Squad Klaw Live Demo"));
  console.log(dim("  Two AI agents negotiate a coffee meeting over the network.\n"));
  console.log(dim("  " + "─ ".repeat(24)));

  // ── Generate identities ──────────────────────────────
  await sleep(300);
  console.log(dim("\n  Generating agent identities...\n"));

  const keysA = generateKeyPair();
  const keysB = generateKeyPair();

  const agentA: AgentCard = {
    squadklaw: "0.1.0",
    agent_id: agentId(),
    name: "Chris's Agent",
    endpoint: "", // filled in after server starts
    public_key: keysA.publicKey,
    capabilities: ["scheduling", "communication"],
    intents: ["mesh.schedule", "mesh.message"],
  };

  const agentB: AgentCard = {
    squadklaw: "0.1.0",
    agent_id: agentId(),
    name: "Sarah's Agent",
    endpoint: "", // filled in after server starts
    public_key: keysB.publicKey,
    capabilities: ["scheduling", "communication", "research"],
    intents: ["mesh.schedule", "mesh.message", "mesh.negotiate"],
  };

  console.log(`  ${cyan("▸")} Agent A: ${bold("Chris's Agent")} ${dim(`(${agentA.agent_id})`)}`);
  console.log(`  ${cyan("▸")} Agent B: ${bold("Sarah's Agent")} ${dim(`(${agentB.agent_id})`)}`);

  // ── Start Agent B's server ────────────────────────────
  await sleep(300);
  console.log(dim("\n  Starting Agent B's server..."));

  const { server, port } = await startAgentServer(agentB, keysB.privateKey, keysA.publicKey);
  agentB.endpoint = `http://localhost:${port}/squadklaw`;

  console.log(`  ${green("✓")} Agent B listening on port ${port}\n`);
  console.log(dim("  " + "─ ".repeat(24)));

  // ── Helper to send a message ──────────────────────────
  async function sendMessage(
    from: AgentCard,
    fromKey: string,
    to: AgentCard,
    intent: string,
    payload: Record<string, unknown>,
    convId: string,
  ): Promise<{ outgoingSig: string; response: Record<string, unknown> }> {
    const msg: Record<string, unknown> = {
      squadklaw: "0.1.0",
      message_id: messageId(),
      conversation_id: convId,
      from: from.agent_id,
      to: to.agent_id,
      timestamp: new Date().toISOString(),
      intent,
      payload,
    };
    const outgoingSig = signMessage(msg, fromKey);
    msg.signature = outgoingSig;

    const res = await fetch(to.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg),
    });

    const response = await res.json() as Record<string, unknown>;
    return { outgoingSig, response };
  }

  const convId = conversationId();

  // ── Step 1: Agent A proposes coffee ───────────────────
  await sleep(500);
  console.log(`\n  ${bold("[1]")} ${yellow("Chris's Agent")} ${dim("→")} ${yellow("Sarah's Agent")}`);
  console.log(`      Intent:    ${cyan("mesh.schedule")}`);
  console.log(`      Action:    ${bold("PROPOSE")}`);
  console.log(`      Title:     Coffee catch-up`);
  console.log(`      Times:     3 options proposed`);
  console.log(`                 ${dim("Fri Feb 21  9:00 AM PST")}`);
  console.log(`                 ${dim("Fri Feb 21 10:00 AM PST")}`);
  console.log(`                 ${dim("Fri Feb 21  2:00 PM PST")}`);
  console.log(`      Duration:  30m`);

  const proposalPayload = {
    action: "propose",
    event: {
      title: "Coffee catch-up",
      proposed_times: [
        "2026-02-21T09:00:00-08:00",
        "2026-02-21T10:00:00-08:00",
        "2026-02-21T14:00:00-08:00",
      ],
      duration: "30m",
      notes: "Been a while, would love to catch up!",
    },
  };

  const { outgoingSig: proposalSig, response: response1 } = await sendMessage(agentA, keysA.privateKey, agentB, "mesh.schedule", proposalPayload, convId);

  console.log(`      Signed:    ${dim(proposalSig.slice(0, 32) + "...")}  ${green("✓")}`);

  // ── Step 2: Agent B counters ──────────────────────────
  await sleep(800);
  const r1payload = (response1 as any).payload ?? response1;
  const counterSig = (response1 as any).signature as string;

  console.log(`\n  ${bold("[2]")} ${yellow("Sarah's Agent")} ${dim("→")} ${yellow("Chris's Agent")}`);
  console.log(`      Intent:    ${cyan("mesh.schedule")}`);
  console.log(`      Action:    ${bold("COUNTER")}`);

  const event = r1payload.event ?? {};
  const selectedTime = event.selected_time ?? "";
  const duration = event.duration ?? "";
  const location = event.location ?? "";

  if (selectedTime) {
    console.log(`      Time:      ${formatTime(selectedTime)}`);
  }
  if (duration) {
    console.log(`      Duration:  ${duration} ${dim("(extended from 30m)")}`);
  }
  if (location) {
    console.log(`      Location:  ${location}`);
  }
  if (event.notes) {
    console.log(`      Notes:     ${dim(event.notes)}`);
  }

  // Verify Agent B's signature
  const sigValid1 = verifyMessage(
    response1 as Record<string, unknown>,
    counterSig,
    keysB.publicKey,
  );
  console.log(`      Signed:    ${dim(counterSig.slice(0, 32) + "...")}  ${sigValid1 ? green("✓") : chalk.red("✗")}`);

  // ── Step 3: Agent A accepts ───────────────────────────
  await sleep(800);
  console.log(`\n  ${bold("[3]")} ${yellow("Chris's Agent")} ${dim("→")} ${yellow("Sarah's Agent")}`);
  console.log(`      Intent:    ${cyan("mesh.schedule")}`);
  console.log(`      Action:    ${bold("ACCEPT")}`);

  const acceptPayload = {
    action: "accept",
    selected_time: selectedTime,
    message: "Perfect, see you at " + (location || "the spot") + "!",
  };

  const { outgoingSig: acceptSig, response: response2 } = await sendMessage(agentA, keysA.privateKey, agentB, "mesh.schedule", acceptPayload, convId);
  const confirmSig = (response2 as any).signature as string;

  console.log(`      Signed:    ${dim(acceptSig.slice(0, 32) + "...")}  ${green("✓")}`);

  // ── Step 4: Confirmed ─────────────────────────────────
  await sleep(600);
  const r2payload = (response2 as any).payload ?? response2;

  console.log(`\n  ${bold("[4]")} ${yellow("Sarah's Agent")} confirms`);
  console.log(`      ${green("✓")} ${r2payload.message ?? "Meeting confirmed."}`);

  // ── Summary ───────────────────────────────────────────
  await sleep(400);
  console.log(dim("\n  " + "─ ".repeat(24)));
  console.log(`
  ${green("✓")} ${bold("Meeting Scheduled!")}

    What:      Coffee catch-up
    When:      ${selectedTime ? formatTime(selectedTime) : "Fri Feb 21, 10:00 AM PST"}
    Where:     ${location || "TBD"}
    Duration:  ${duration || "30m"}

    Messages exchanged:  ${bold("3")}
    Signatures verified: ${bold("3")}
    Human involvement:   ${bold("0")}
`);

  // ── Cleanup ───────────────────────────────────────────
  server.close();
  process.exit(0);
}

/**
 * Start a temporary HTTP server for an agent.
 * Returns the server and the port it's listening on.
 */
function startAgentServer(
  card: AgentCard,
  privateKey: string,
  senderPublicKey: string,
): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      if (req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ agent: card.name, agent_id: card.agent_id, status: "online" }));
        return;
      }

      if (req.method === "POST") {
        let body = "";
        for await (const chunk of req) body += chunk;

        try {
          const message = JSON.parse(body);
          const parsed = MessageSchema.safeParse(message);

          if (!parsed.success) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              error: { code: "INVALID_MESSAGE", message: "Invalid message format", retry: false },
            }));
            return;
          }

          // Verify sender's signature
          const sigValid = verifyMessage(
            message as Record<string, unknown>,
            parsed.data.signature,
            senderPublicKey,
          );

          if (!sigValid) {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              error: { code: "INVALID_SIGNATURE", message: "Signature verification failed", retry: false },
            }));
            return;
          }

          // Route to handler
          const result = handleMessage(parsed.data, {
            agentName: card.name,
            agentId: card.agent_id,
          });

          // Build and sign response
          const response: Record<string, unknown> = {
            squadklaw: "0.1.0",
            message_id: messageId(),
            conversation_id: parsed.data.conversation_id,
            from: card.agent_id,
            to: parsed.data.from,
            timestamp: new Date().toISOString(),
            intent: parsed.data.intent,
            payload: result.payload,
          };

          response.signature = signMessage(response, privateKey);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(response));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            error: { code: "INVALID_MESSAGE", message: "Invalid JSON", retry: false },
          }));
        }
        return;
      }

      res.writeHead(404);
      res.end();
    });

    // Listen on random available port
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, port });
    });
  });
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}
