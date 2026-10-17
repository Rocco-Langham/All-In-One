import { SlashCommandBuilder } from 'discord.js';
import { infoEmbed } from '../../../core/embeds.js';
import type { Command } from '../../../core/types.js';

export const pingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check that the bot is responding.'),
  async execute(interaction) {
    const response = await interaction.reply({ content: 'Pinging…', withResponse: true });
    const sentAt = response.resource?.message?.createdTimestamp ?? Date.now();
    await interaction.editReply({
      content: '',
      embeds: [
        infoEmbed(interaction.guildId, '🏓 Pong!').addFields(
          {
            name: 'Round trip',
            value: `${sentAt - interaction.createdTimestamp} ms`,
            inline: true,
          },
          { name: 'Gateway', value: `${Math.round(interaction.client.ws.ping)} ms`, inline: true },
        ),
      ],
    });
  },
};
