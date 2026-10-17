import { AttachmentBuilder, type Client } from 'discord.js';
import { logger } from '../../core/logger.js';
import { deleteStickyRow, getStickyForChannel, setLastMessage, type Sticky } from './store.js';

/** Waits for a channel to go quiet this long before reposting, so busy chats aren't spammed. */
const REPOST_DELAY_MS = 5_000;

const timers = new Map<string, NodeJS.Timeout>();
// The bot's own sticky post must not trigger another repost, or it would loop forever.
// Discord may announce the new message before or after send() returns, so both are tracked:
// channels mid-post, and the id of the copy most recently posted in each channel.
const posting = new Set<string>();
const latestCopy = new Map<string, string>();

export function isOwnStickyPost(channelId: string, messageId: string) {
  return posting.has(channelId) || latestCopy.get(channelId) === messageId;
}

async function deleteCopy(client: Client, sticky: Sticky) {
  if (!sticky.lastMessageId) return;
  try {
    const channel = await client.channels.fetch(sticky.channelId);
    if (channel?.isTextBased()) await channel.messages.delete(sticky.lastMessageId);
  } catch {
    // Already deleted by someone, or the channel is gone. Nothing to clean up.
  }
}

/** Removes the old copy of a sticky and posts it again at the bottom of its channel. */
export async function postSticky(client: Client, sticky: Sticky) {
  const channel = await client.channels.fetch(sticky.channelId).catch(() => null);
  if (!channel?.isSendable()) {
    logger.warn(`Sticky channel ${sticky.channelId} can't be posted in`);
    return false;
  }

  await deleteCopy(client, sticky);
  posting.add(sticky.channelId);
  try {
    const message = await channel.send({
      content: sticky.content ?? undefined,
      files:
        sticky.imageData && sticky.imageName
          ? [new AttachmentBuilder(Buffer.from(sticky.imageData), { name: sticky.imageName })]
          : [],
      allowedMentions: { parse: [] },
    });
    latestCopy.set(sticky.channelId, message.id);
    await setLastMessage(sticky.id, message.id);
    return true;
  } catch (err) {
    logger.warn(`Couldn't post the sticky in channel ${sticky.channelId}`, err);
    return false;
  } finally {
    posting.delete(sticky.channelId);
  }
}

/** Reposts a channel's sticky once the channel has been quiet for a few seconds. */
export function scheduleRepost(client: Client, channelId: string) {
  clearTimeout(timers.get(channelId));
  timers.set(
    channelId,
    setTimeout(() => {
      timers.delete(channelId);
      void getStickyForChannel(channelId)
        .then((sticky) => sticky && postSticky(client, sticky))
        .catch((err) => logger.error(`Sticky repost in ${channelId} failed`, err));
    }, REPOST_DELAY_MS),
  );
}

/** Deletes a sticky and its copy in the channel. */
export async function removeSticky(client: Client, sticky: Sticky) {
  clearTimeout(timers.get(sticky.channelId));
  timers.delete(sticky.channelId);
  latestCopy.delete(sticky.channelId);
  await deleteCopy(client, sticky);
  await deleteStickyRow(sticky.id);
}
