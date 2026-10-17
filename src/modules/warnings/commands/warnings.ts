import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../../../core/types.js';
import { initialState, renderList } from './allwarnings.js';

export const warningsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription("Show all of one player's warnings.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) =>
      o.setName('user').setDescription('Whose warnings to show').setRequired(true),
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) return;
    const user = interaction.options.getUser('user', true);
    const message = await renderList(interaction.guildId, initialState(user.id));
    await interaction.reply({ ...message, flags: message.flags | MessageFlags.Ephemeral });
  },
};
