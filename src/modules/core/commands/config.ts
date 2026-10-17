import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { asMessage, homeView } from '../../../core/configPanel.js';
import type { Command } from '../../../core/types.js';

export const configCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Open the settings menu for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (!interaction.inGuild()) return;
    const message = asMessage(homeView(interaction.guildId));
    await interaction.reply({ ...message, flags: message.flags | MessageFlags.Ephemeral });
  },
};
