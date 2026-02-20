import chalk from "chalk";
import { createServer } from "node:http";
import { loadCard, loadKeys, loadConfig, isInitialized } from "../config.js";
import {
  MessageSchema,
  signMessage,
  verifyMessage,
  messageId,
} from "@squadklaw/core";
import { handleMessage } from "../handlers.js";

export async function serveCommand(opts: { port: string }) {
  if (!isInitialized()) {
    console.log(chalk.red("\n  Not initialized. Run `sklaw init` first.\n"));
    return;
  }

  const card = loadCard()!;
  const keys = loadKeys()!;
  const config = loadConfig();
  const port = parseInt(opts.port, 10);

  // Cache public keys from directory lookups
  const keyCache = new Map<string, string>();

  async function lookupPublicKey(agentId: string): Promise<string | null> {
    if (keyCache.has(agentId)) return keyCache.get(agentId)!;
    try {
      const res = await fetch(`${config.directoryUrl}/agents/${agentId}`);
      if (!res.ok) return null;
      const agent = await res.json() as { public_key?: string };
      if (agent.public_key) {
        keyCache.set(agentId, agent.public_key);
        return agent.public_key;
      }
    } catch {}
    return null;
  }

  console.log(chalk.bold("\n  Squad Klaw Agent Server\n"));
  console.log(`  Agent:     ${card.name} (${chalk.cyan(card.agent_id)})`);
  console.log(`  Directory: ${chalk.dim(config.directoryUrl)}`);
  console.log(`  Listening: port ${port}`);
  console.log(chalk.dim("  Press Ctrl+C to stop\n"));

  const server = createServer(async (req, res) => {
    // Health check
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ agent: card.name, agent_id: card.agent_id, status: "online" }));
      return;
    }

    // Agent endpoint
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

        const incoming = parsed.data;
        const ts = new Date().toLocaleTimeString();

        // Verify the sender's signature
        let signatureValid = false;
        const senderKey = await lookupPublicKey(incoming.from);
        if (senderKey) {
          try {
            signatureValid = verifyMessage(
              message as Record<string, unknown>,
              incoming.signature,
              senderKey
            );
          } catch {}
        }

        const sigStatus = signatureValid
          ? chalk.green("VERIFIED")
          : senderKey
            ? chalk.red("INVALID SIG")
            : chalk.yellow("UNVERIFIED (key not found)");

        console.log(chalk.cyan("  ┌─ Incoming Message ─────────────────────────"));
        console.log(`  │ Time:      ${chalk.dim(ts)}`);
        console.log(`  │ From:      ${chalk.yellow(incoming.from)}`);
        console.log(`  │ Intent:    ${incoming.intent}`);
        console.log(`  │ Conv:      ${chalk.dim(incoming.conversation_id)}`);
        console.log(`  │ Signature: ${sigStatus}`);

        if (!signatureValid && senderKey) {
          console.log(chalk.red(`  │ ✗ Rejecting message with invalid signature`));
          console.log(chalk.cyan("  └──────────────────────────────────────────\n"));
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            error: { code: "INVALID_SIGNATURE", message: "Signature verification failed", retry: false },
          }));
          return;
        }

        // Route to intent handler
        const result = handleMessage(incoming, {
          agentName: card.name,
          agentId: card.agent_id,
        });

        // Log handler output
        console.log(`  │`);
        for (const line of result.log) {
          console.log(`  │ ${line}`);
        }

        // Build and sign the response
        const response: Record<string, unknown> = {
          squadklaw: "0.1.0",
          message_id: messageId(),
          conversation_id: incoming.conversation_id,
          from: card.agent_id,
          to: incoming.from,
          timestamp: new Date().toISOString(),
          intent: incoming.intent,
          payload: result.payload,
        };

        const signature = signMessage(response, keys.privateKey);
        response.signature = signature;

        console.log(`  │`);
        console.log(`  │ Response:  ${chalk.green(JSON.stringify(result.payload.action ?? "sent"))}`);
        console.log(`  │ Signed:    ${chalk.dim(signature.slice(0, 32))}...`);
        console.log(chalk.cyan("  └──────────────────────────────────────────\n"));

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

  server.listen(port, () => {
    console.log(chalk.green(`  ✓ Agent server running on http://localhost:${port}`));
    console.log(chalk.dim("  Waiting for messages...\n"));
  });
}
