import { Events, type Client } from 'discord.js';
import { logger } from '../../core/logger.js';
import { isModuleEnabled } from '../../core/settings.js';
import { defineEvent } from '../../core/types.js';
import { isOwnStickyPost, removeSticky, scheduleRepost } from './poster.js';
import { expiredStickies, hasSticky, loadStickyChannels } from './store.js';

const EXPIRY_CHECK_MS = 60_000;

async function removeExpired(client: Client) {
  for (const sticky of await expiredStickies()) {
    await removeSticky(client, sticky);
    logger.info(`Sticky in channel ${sticky.channelId} expired and was removed`);
  }
}

export const stickyStartup = defineEvent({
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    await loadStickyChannels();
    await removeExpired(client);
    setInterval(() => {
      removeExpired(client).catch((err) => logger.error('Sticky expiry check failed', err));
    }, EXPIRY_CHECK_MS);
  },
});

export const stickyOnMessage = defineEvent({
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.inGuild() || !hasSticky(message.channelId)) return;
    // Don't react to the sticky the bot itself just posted.
    if (
      message.author.id === message.client.user.id &&
      isOwnStickyPost(message.channelId, message.id)
    ) {
      return;
    }
    if (!(await isModuleEnabled(message.guildId, 'sticky'))) return;
    scheduleRepost(message.client, message.channelId);
  },
});
