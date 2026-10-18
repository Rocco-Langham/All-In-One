import { AttachmentBuilder, type Client } from 'discord.js';
import { logger } from '../../core/logger.js';
import { deleteStickyRow, getStickyForChannel, setLastMessage, type Sticky } from './store.js';

/** Waits for a channel to go quiet this long before reposting, so busy chats aren't spammed. */
const REPOST_DELAY_MS = 1_500;
/** In a chat that never goes quiet, repost at least this often anyway. */
const MAX_WAIT_MS = 4_000;

const timers = new Map<string, NodeJS.Timeout>();
/** When each channel's pending repost was first asked for. */
const waitingSince = new Map<string, number>();
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

/** Posts a sticky again at the bottom of its channel, then removes the old copy. */
export async function postSticky(client: Client, sticky: Sticky) {
  const channel = await client.channels.fetch(sticky.channelId).catch(() => null);
  if (!channel?.isSendable()) {
    logger.warn(`Sticky channel ${sticky.channelId} can't be posted in`);
    return false;
  }

  // The new copy goes out first so the sticky shows up straight away; the old one is
  // deleted afterwards instead of making the new one wait for it.
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
    await Promise.all([setLastMessage(sticky.id, message.id), deleteCopy(client, sticky)]);
    return true;
  } catch (err) {
    logger.warn(`Couldn't post the sticky in channel ${sticky.channelId}`, err);
    return false;
  } finally {
    posting.delete(sticky.channelId);
  }
}

/**
 * Reposts a channel's sticky once the channel has been quiet for a moment, or after
 * MAX_WAIT_MS at most if people keep chatting.
 */
export function scheduleRepost(client: Client, channelId: string) {
  const now = Date.now();
  const since = waitingSince.get(channelId) ?? now;
  waitingSince.set(channelId, since);
  const delay = Math.max(0, Math.min(REPOST_DELAY_MS, since + MAX_WAIT_MS - now));

  clearTimeout(timers.get(channelId));
  timers.set(
    channelId,
    setTimeout(() => {
      timers.delete(channelId);
      waitingSince.delete(channelId);
      // Still busy posting the last copy: try again shortly instead of doubling up.
      if (posting.has(channelId)) return scheduleRepost(client, channelId);
      void getStickyForChannel(channelId)
        .then((sticky) => sticky && postSticky(client, sticky))
        .catch((err) => logger.error(`Sticky repost in ${channelId} failed`, err));
    }, delay),
  );
}

/** Deletes a sticky and its copy in the channel. */
export async function removeSticky(client: Client, sticky: Sticky) {
  clearTimeout(timers.get(sticky.channelId));
  timers.delete(sticky.channelId);
  waitingSince.delete(sticky.channelId);
  latestCopy.delete(sticky.channelId);
  await deleteCopy(client, sticky);
  await deleteStickyRow(sticky.id);
}
