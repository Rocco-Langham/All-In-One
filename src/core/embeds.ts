import { EmbedBuilder } from 'discord.js';
import { themeColor } from './theme.js';

/** Errors stay red whatever the server's theme, so they always stand out. */
export const ERROR_COLOR = 0xed4245;

export function infoEmbed(guildId: string | null, title: string, description?: string) {
  const embed = new EmbedBuilder().setColor(themeColor(guildId)).setTitle(title);
  return description ? embed.setDescription(description) : embed;
}

export function successEmbed(guildId: string | null, description: string) {
  return new EmbedBuilder().setColor(themeColor(guildId)).setDescription(`✅ ${description}`);
}

export function errorEmbed(description: string) {
  return new EmbedBuilder().setColor(ERROR_COLOR).setDescription(`❌ ${description}`);
}
