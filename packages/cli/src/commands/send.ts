import chalk from "chalk";
import { loadCard, loadKeys, loadConfig, isInitialized } from "../config.js";
import {
  SquadKlawClient,
  MessageSchema,
  signMessage,
  messageId,
  conversationId,
  type ErrorResponse,
} from "@squadklaw/core";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendCommand(
  agentIdArg: string,
  opts: {
    intent: string;
    payload: string;
    conversation?: string;
    timeout?: string;
  },
) {
  if (!isInitialized()) {
    console.log(chalk.red("\n  Not initialized. Run `sklaw init` first.\n"));
    return;
  }

  const card = loadCard()!;
  const keys = loadKeys()!;
  const config = loadConfig();

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(opts.payload);
  } catch {
    console.log(chalk.red("\n  Invalid JSON payload.\n"));
    return;
  }

  if (!config.token) {
    console.log(chalk.red("\n  Not registered. Run `sklaw register` first.\n"));
    return;
  }

  const client = new SquadKlawClient({
    agentCard: card,
    privateKey: keys.privateKey,
    directoryUrl: config.directoryUrl,
  });

  console.log(chalk.bold("\n  Sending message...\n"));
  console.log(`  To:     ${chalk.cyan(agentIdArg)}`);
  console.log(`  Intent: ${opts.intent}`);

  try {
    // Look up the target agent
    const target = await client.getAgent(agentIdArg);
    console.log(`  Name:   ${target.name}`);

    // Build and sign the message
    const convId = opts.conversation ?? conversationId();
    const msg: Record<string, unknown> = {
      squadklaw: "0.1.0",
      message_id: messageId(),
      conversation_id: convId,
      from: card.agent_id,
      to: target.agent_id,
      timestamp: new Date().toISOString(),
      intent: opts.intent,
      payload,
    };
    const signature = signMessage(msg, keys.privateKey);
    msg.signature = signature;

    // Validate before sending
    MessageSchema.parse(msg);

    // Send through relay
    const relayUrl = config.directoryUrl.replace(/\/v1\/?$/, "/v1/relay");
    const res = await fetch(relayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(msg),
    });

    if (!res.ok) {
      const err = await res.json() as any;
      console.log(`\n  ${chalk.red("✗")} ${err.error?.code ?? "ERROR"}: ${err.error?.message ?? res.statusText}\n`);
      return;
    }

    const relayResult = await res.json() as { relay_id: string; status: string };
    console.log(`\n  ${chalk.green("✓")} Message queued!`);
    console.log(`  Relay ID:        ${chalk.dim(relayResult.relay_id)}`);
    console.log(`  Conversation ID: ${chalk.dim(convId)}`);

    // Poll for response
    const timeoutMs = parseInt(opts.timeout ?? "30000", 10);
    console.log(chalk.dim(`\n  Waiting for response (${timeoutMs / 1000}s timeout)...`));

    const pollUrl = `${relayUrl}?conversation=${convId}`;
    const deadline = Date.now() + timeoutMs;
    let responded = false;

    while (Date.now() < deadline) {
      await sleep(2000);

      const pollRes = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${config.token}` },
      });

      if (!pollRes.ok) continue;

      const pollData = await pollRes.json() as { messages: Array<{ relay_id: string; message: any }> };
      if (pollData.messages.length > 0) {
        const response = pollData.messages[0];
        responded = true;

        // Acknowledge the message
        await fetch(`${relayUrl}/${response.relay_id}/ack`, {
          method: "POST",
          headers: { Authorization: `Bearer ${config.token}` },
        });

        console.log(`\n  ${chalk.green("✓")} Response received!`);
        console.log(`  From:    ${chalk.yellow(response.message.from)}`);
        console.log(`\n  Response payload:`);
        const payloadStr = JSON.stringify(response.message.payload, null, 2);
        console.log(chalk.dim(`  ${payloadStr.split("\n").join("\n  ")}`));
        console.log();
        break;
      }
    }

    if (!responded) {
      console.log(`\n  ${chalk.yellow("⏳")} No response yet. The recipient will see your message when they come online.`);
      console.log(`  Conversation: ${chalk.dim(convId)}\n`);
    }
  } catch (err: any) {
    console.log(`\n  ${chalk.red("✗")} Send failed: ${err.message}\n`);
  }
}
