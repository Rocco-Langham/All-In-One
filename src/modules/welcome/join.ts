import type { GuildMember } from 'discord.js';
import { logger } from '../../core/logger.js';
import {
  DEFAULT_WELCOME_MESSAGE,
  fillWelcomeMessage,
  getAutoRoles,
  getWelcomeSettings,
} from './settings.js';

/** Posts the welcome message for a member. Returns false if it couldn't be sent. */
export async function sendWelcome(member: GuildMember): Promise<boolean> {
  const { channelId, message } = await getWelcomeSettings(member.guild.id);
  if (!channelId) return false;
  try {
    const channel = await member.guild.channels.fetch(channelId);
    if (!channel?.isSendable()) return false;
    await channel.send({
      content: fillWelcomeMessage(message ?? DEFAULT_WELCOME_MESSAGE, member),
      // Ping the new member only, never @everyone or roles typed into the message.
      allowedMentions: { users: [member.id] },
    });
    return true;
  } catch (err) {
    logger.warn(`Couldn't send the welcome message in ${member.guild.name}`, err);
    return false;
  }
}

export async function giveAutoRoles(member: GuildMember) {
  const roleIds = await getAutoRoles(member.guild.id);
  if (roleIds.length === 0) return;
  try {
    await member.roles.add(roleIds, 'Auto role for new members');
  } catch (err) {
    logger.warn(`Couldn't give auto roles in ${member.guild.name}`, err);
  }
}
