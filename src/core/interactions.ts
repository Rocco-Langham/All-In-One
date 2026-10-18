import { MessageFlags, type Interaction, type RepliableInteraction } from 'discord.js';
import { canUseCommands } from './access.js';
import { errorEmbed } from './embeds.js';
import { logger } from './logger.js';
import { findCommand, findComponentHandler } from './registry.js';
import { isModuleEnabled } from './settings.js';
import type { BotModule } from './types.js';

async function replyError(interaction: RepliableInteraction, message: string) {
  const payload = { embeds: [errorEmbed(message)], flags: MessageFlags.Ephemeral } as const;
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload).catch(() => {});
  } else {
    await interaction.reply(payload).catch(() => {});
  }
}

/** Replies with an error and returns false if the module is switched off in this server. */
async function ensureEnabled(interaction: RepliableInteraction, mod: BotModule) {
  if (!interaction.inGuild() || (await isModuleEnabled(interaction.guildId, mod.id))) return true;
  await replyError(interaction, `The **${mod.name}** module is turned off in this server.`);
  return false;
}

async function run(interaction: RepliableInteraction, label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    logger.error(`${label} failed`, err);
    await replyError(interaction, 'Something went wrong. Please try again.');
  }
}

/** Replies with an error and returns false if Settings → Command access shuts this member out. */
async function ensureAccess(interaction: RepliableInteraction) {
  if (!interaction.inCachedGuild() || (await canUseCommands(interaction.member))) return true;
  await replyError(interaction, "You don't have a role that is allowed to use my commands.");
  return false;
}

export async function handleInteraction(interaction: Interaction) {
  if (interaction.isAutocomplete()) {
    if (interaction.inCachedGuild() && !(await canUseCommands(interaction.member))) {
      await interaction.respond([]).catch(() => {});
      return;
    }
    const entry = findCommand(interaction.commandName);
    await entry?.command.autocomplete?.(interaction).catch((err) => {
      logger.error(`Autocomplete for /${interaction.commandName} failed`, err);
    });
    return;
  }

  if (interaction.isChatInputCommand()) {
    const entry = findCommand(interaction.commandName);
    if (!entry || !(await ensureAccess(interaction))) return;
    if (!(await ensureEnabled(interaction, entry.module))) return;
    await run(interaction, `/${interaction.commandName}`, () => entry.command.execute(interaction));
    return;
  }

  if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
    const entry = findComponentHandler(interaction.customId);
    if (!entry || !(await ensureEnabled(interaction, entry.module))) return;
    await run(interaction, `Component ${interaction.customId}`, () =>
      entry.handler.execute(interaction),
    );
  }
}
