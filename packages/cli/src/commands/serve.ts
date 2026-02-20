import chalk from "chalk";
import { loadCard, loadKeys, loadConfig, isInitialized } from "../config.js";
import {
  MessageSchema,
  signMessage,
  verifyMessage,
  messageId,
} from "@squadklaw/core";
import { handleMessage } from "../handlers.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function serveCommand(opts: { port: string; interval?: string }) {
  if (!isInitialized()) {
    console.log(chalk.red("\n  Not initialized. Run `sklaw init` first.\n"));
    return;
  }

  const card = loadCard()!;
  const keys = loadKeys()!;
  const config = loadConfig();

  if (!config.token) {
    console.log(chalk.red("\n  Not registered. Run `sklaw register` first.\n"));
    return;
  }

  const pollIntervalMs = parseInt(opts.interval ?? "3000", 10);
  const relayUrl = config.directoryUrl.replace(/\/v1\/?$/, "/v1/relay");
  const authHeaders = { Authorization: `Bearer ${config.token}` };

  // Cache public keys from directory lookups
  const keyCache = new Map<string, string>();

  async function lookupPublicKey(agentId: string): Promise<string | null> {
    if (keyCache.has(agentId)) return keyCache.get(agentId)!;
    try {
      const res = await fetch(`${config.directoryUrl}/agents/${agentId}`);
      if (!res.ok) return null;
      const agent = (await res.json()) as { public_key?: string };
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
  console.log(`  Mode:      Relay polling (every ${pollIntervalMs / 1000}s)`);
  console.log(chalk.dim("  Press Ctrl+C to stop\n"));
  console.log(chalk.green(`  ✓ Listening for messages via relay`));
  console.log(chalk.dim("  Waiting for messages...\n"));

  // Poll loop
  while (true) {
    try {
      const res = await fetch(relayUrl, { headers: authHeaders });

      if (!res.ok) {
        await sleep(pollIntervalMs);
        continue;
      }

      const data = (await res.json()) as {
        messages: Array<{ relay_id: string; message: any; created_at: string }>;
      };

      for (const item of data.messages) {
        const raw = item.message;
        const parsed = MessageSchema.safeParse(raw);

        if (!parsed.success) {
          // Ack bad messages so they don't loop
          await fetch(`${relayUrl}/${item.relay_id}/ack`, {
            method: "POST",
            headers: authHeaders,
          });
          continue;
        }

        const incoming = parsed.data;
        const ts = new Date().toLocaleTimeString();

        // Verify signature
        let signatureValid = false;
        const senderKey = await lookupPublicKey(incoming.from);
        if (senderKey) {
          try {
            signatureValid = verifyMessage(
              raw as Record<string, unknown>,
              incoming.signature,
              senderKey,
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
          await fetch(`${relayUrl}/${item.relay_id}/ack`, {
            method: "POST",
            headers: authHeaders,
          });
          continue;
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

        // Send response back through relay
        const sendRes = await fetch(relayUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify(response),
        });

        const sendOk = sendRes.ok;

        console.log(`  │`);
        console.log(`  │ Response:  ${chalk.green(JSON.stringify(result.payload.action ?? "sent"))}`);
        console.log(`  │ Signed:    ${chalk.dim(signature.slice(0, 32))}...`);
        console.log(`  │ Relayed:   ${sendOk ? chalk.green("YES") : chalk.red("FAILED")}`);
        console.log(chalk.cyan("  └──────────────────────────────────────────\n"));

        // Acknowledge the incoming message
        await fetch(`${relayUrl}/${item.relay_id}/ack`, {
          method: "POST",
          headers: authHeaders,
        });
      }
    } catch (err: any) {
      // Network error — keep polling
      if (err.code !== "ECONNREFUSED") {
        console.log(chalk.dim(`  Poll error: ${err.message}`));
      }
    }

    await sleep(pollIntervalMs);
  }
}
