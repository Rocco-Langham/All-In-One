import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { infoEmbed } from '../../../core/embeds.js';
import { getModules } from '../../../core/registry.js';
import { isModuleEnabled } from '../../../core/settings.js';
import type { Command } from '../../../core/types.js';

export const helpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List everything the bot can do here.'),
  async execute(interaction) {
    const embed = infoEmbed(interaction.guildId, 'All In One: Commands');

    for (const mod of getModules()) {
      if (mod.commands.length === 0) continue;
      if (interaction.inGuild() && !(await isModuleEnabled(interaction.guildId, mod.id))) continue;
      const lines = mod.commands.map((c) => `\`/${c.data.name}\` - ${c.data.description}`);
      embed.addFields({ name: mod.name, value: lines.join('\n') });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
