import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { BotClient } from './lib/client';
import { Command } from './types';

const client = new BotClient();

// ── Load commands ──────────────────────────────────────────────────────────────
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file)) as Partial<Command>;
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command as Command);
  } else {
    console.warn(`[WARN] ${file} is missing 'data' or 'execute' — skipping.`);
  }
}

// ── Load events ───────────────────────────────────────────────────────────────
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file)) as {
    name: string;
    once: boolean;
    execute: (...args: unknown[]) => Promise<void>;
  };

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────
if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
