import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { env } from './config/env.js';
import { db } from './core/db.js';
import { handleInteraction } from './core/interactions.js';
import { logger } from './core/logger.js';
import { getModules } from './core/registry.js';

const client = new Client({
  // Add intents here as modules need them. GuildMembers (used by Welcome to see joins) is a
  // privileged intent: it must also be switched on in the Developer Portal → Bot.
  // GuildMessages lets Sticky messages notice new messages (not their content).
  // GuildInvites lets Invite tracking keep its invite counts up to date.
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildInvites,
  ],
  // Without this, Discord's "member left" event is skipped for members the bot hasn't seen
  // since it started, and Invite tracking would miss them leaving.
  partials: [Partials.GuildMember],
});

for (const mod of getModules()) {
  for (const event of mod.events) {
    const run = event.execute as (...args: unknown[]) => unknown;
    const listener = (...args: unknown[]) =>
      Promise.resolve()
        .then(() => run(...args))
        .catch((err) => logger.error(`Event ${event.name} in module "${mod.id}" failed`, err));
    if (event.once) client.once(event.name, listener);
    else client.on(event.name, listener);
  }
  logger.info(
    `Loaded module "${mod.id}" (${mod.commands.length} commands, ${mod.events.length} events)`,
  );
}

client.on(Events.InteractionCreate, handleInteraction);

client.once(Events.ClientReady, (c) => {
  logger.info(`Logged in as ${c.user.tag} in ${c.guilds.cache.size} servers`);
});

async function shutdown() {
  logger.info('Shutting down');
  await client.destroy();
  await db.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await client.login(env.token);
} catch (err) {
  if (err instanceof Error && /disallowed intents/i.test(err.message)) {
    logger.error(
      'Discord refused to connect: turn on "Server Members Intent" at ' +
        'https://discord.com/developers/applications → your bot → Bot → Privileged Gateway Intents.',
    );
    await db.$disconnect();
    process.exit(1);
  }
  throw err;
}
