import { REST, Routes } from 'discord.js';
import { env } from '../src/config/env.js';
import { allCommands } from '../src/core/registry.js';

// By default commands are registered for every server the bot is in.
// With --dev they go only to DEV_GUILD_ID, which updates instantly while testing.
const devOnly = process.argv.includes('--dev');

const body = allCommands().map((c) => c.data.toJSON());
const rest = new REST().setToken(env.token);

if (devOnly) {
  if (!env.devGuildId) throw new Error('Set DEV_GUILD_ID in .env to use --dev.');
  await rest.put(Routes.applicationGuildCommands(env.clientId, env.devGuildId), { body });
  console.log(`Registered ${body.length} commands to test server ${env.devGuildId} only.`);
} else {
  await rest.put(Routes.applicationCommands(env.clientId), { body });
  console.log(`Registered ${body.length} commands for every server.`);

  // Remove any test-server-only copies, or that server would show every command twice.
  if (env.devGuildId) {
    await rest.put(Routes.applicationGuildCommands(env.clientId, env.devGuildId), { body: [] });
    console.log(`Removed the test-only copies from server ${env.devGuildId}.`);
  }
}
