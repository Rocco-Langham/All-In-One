import { EmbedBuilder, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { logger } from '../../core/logger.js';
import { themeColor } from '../../core/theme.js';
import type { Command } from '../../core/types.js';

export const memberCountCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('membercount')
    .setDescription('How many members the server has, with and without bots.')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    const guild = interaction.guild;

    // Make sure every member is loaded so the bot count is exact. If Discord is busy,
    // fall back to the members already known.
    await guild.members.fetch().catch((err) => logger.warn('Fetching all members failed', err));
    const bots = guild.members.cache.filter((m) => m.user.bot).size;
    const total = guild.memberCount;
    const humans = total - bots;

    const embed = new EmbedBuilder()
      .setColor(themeColor(guild.id))
      .setTitle(`👥 ${guild.name}`)
      .addFields(
        { name: 'Members (no bots)', value: `**${humans.toLocaleString()}**`, inline: true },
        { name: 'Bots', value: `**${bots.toLocaleString()}**`, inline: true },
        { name: 'Total (with bots)', value: `**${total.toLocaleString()}**`, inline: true },
      )
      .setTimestamp();
    const icon = guild.iconURL();
    if (icon) embed.setThumbnail(icon);

    await interaction.reply({ embeds: [embed] });
  },
};
