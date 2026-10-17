import type { EmbedBuilder, Guild } from 'discord.js';
import { logger } from '../../core/logger.js';
import { DEFAULT_ALERT_MESSAGE, getWarnSettings } from './settings.js';

async function sendToChannel(
  guild: Guild,
  channelId: string | null,
  payload: { content?: string; embeds?: EmbedBuilder[] },
) {
  if (!channelId) return;
  try {
    const channel = await guild.channels.fetch(channelId);
    if (!channel?.isSendable()) return;
    // Pings only users and roles written into the message, never @everyone/@here.
    await channel.send({ ...payload, allowedMentions: { parse: ['users', 'roles'] } });
  } catch (err) {
    // A deleted channel or missing permission shouldn't break /warn itself.
    logger.warn(`Couldn't post to warning channel ${channelId} in ${guild.name}`, err);
  }
}

/** Posts an entry to the log channel, if one is set. */
export async function logWarningEvent(guild: Guild, embed: EmbedBuilder) {
  const { logChannelId } = await getWarnSettings(guild.id);
  await sendToChannel(guild, logChannelId, { embeds: [embed] });
}

/** Posts the alert message if this warning number is the one the alert is set for. */
export async function sendAlertIfReached(
  guild: Guild,
  details: { userId: string; moderatorId: string; level: number; reason: string | null },
) {
  const { alertLevel, alertMessage, alertChannelId, logChannelId } = await getWarnSettings(
    guild.id,
  );
  if (alertLevel === null || details.level !== alertLevel) return;

  const content = (alertMessage ?? DEFAULT_ALERT_MESSAGE)
    .replaceAll('{user}', `<@${details.userId}>`)
    .replaceAll('{moderator}', `<@${details.moderatorId}>`)
    .replaceAll('{warning}', String(details.level))
    .replaceAll('{reason}', details.reason ?? 'No reason given');
  await sendToChannel(guild, alertChannelId ?? logChannelId, { content });
}
