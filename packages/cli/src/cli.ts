#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { initCommand } from "./commands/init.js";
import { statusCommand } from "./commands/status.js";
import { registerCommand } from "./commands/register.js";
import { discoverCommand } from "./commands/discover.js";
import { sendCommand } from "./commands/send.js";
import { serveCommand } from "./commands/serve.js";
import { directoryCommand } from "./commands/directory.js";
import { demoCommand } from "./commands/demo.js";

const program = new Command();

program
  .name("sklaw")
  .description("Squad Klaw — agent-to-agent communication from your terminal")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize your agent identity (keypair + agent card)")
  .option("-n, --name <name>", "Agent display name")
  .option("-e, --endpoint <url>", "Public HTTPS endpoint for receiving messages")
  .option("-d, --directory <url>", "Directory server URL", "http://localhost:3141/v1")
  .action(initCommand);

program
  .command("status")
  .description("Show your agent identity and config")
  .action(statusCommand);

program
  .command("register")
  .description("Register your agent in the directory")
  .option("-t, --token <token>", "Registration token")
  .action(registerCommand);

program
  .command("discover")
  .description("Find other agents in the directory")
  .option("-c, --capability <cap>", "Filter by capability")
  .option("-i, --intent <intent>", "Filter by intent")
  .option("-q, --query <text>", "Free-text search")
  .option("-l, --limit <n>", "Max results", "10")
  .action(discoverCommand);

program
  .command("send <agent_id>")
  .description("Send a message to another agent")
  .requiredOption("--intent <intent>", "Message intent (e.g. mesh.schedule)")
  .requiredOption("--payload <json>", "JSON payload")
  .option("--conversation <id>", "Existing conversation ID")
  .option("--timeout <ms>", "Response wait timeout in ms", "30000")
  .action(sendCommand);

program
  .command("serve")
  .description("Start listening for incoming agent messages via relay")
  .option("-p, --port <port>", "Legacy: port for direct HTTP mode", "3142")
  .option("--interval <ms>", "Relay poll interval in ms", "3000")
  .action(serveCommand);

program
  .command("directory")
  .description("Start a local directory server")
  .option("-p, --port <port>", "Port to listen on", "3141")
  .action(directoryCommand);

program
  .command("demo")
  .description("Run a live demo: two agents negotiate a meeting over the network")
  .action(demoCommand);

program.parse();
