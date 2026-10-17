import { db } from '../../core/db.js';

/** Keeps the /config page within Discord's limit on components per message. */
export const MAX_STICKIES = 8;

/** Channels that have a sticky, so ordinary messages don't each need a database lookup. */
const stickyChannels = new Set<string>();

export async function loadStickyChannels() {
  const rows = await db.stickyMessage.findMany({ select: { channelId: true } });
  stickyChannels.clear();
  for (const row of rows) stickyChannels.add(row.channelId);
}

export function hasSticky(channelId: string) {
  return stickyChannels.has(channelId);
}

export function listStickies(guildId: string) {
  return db.stickyMessage.findMany({
    where: { guildId },
    orderBy: { createdAt: 'asc' },
    // The image itself isn't needed to show the list.
    select: { id: true, channelId: true, content: true, imageName: true, expiresAt: true },
  });
}

export function getStickyForChannel(channelId: string) {
  return db.stickyMessage.findUnique({ where: { channelId } });
}

export function getSticky(guildId: string, id: number) {
  return db.stickyMessage.findFirst({ where: { guildId, id } });
}

export type Sticky = NonNullable<Awaited<ReturnType<typeof getStickyForChannel>>>;

export async function saveSticky(data: {
  guildId: string;
  channelId: string;
  content: string | null;
  image: { name: string; data: Buffer } | null;
  expiresAt: Date | null;
}): Promise<Sticky> {
  const fields = {
    guildId: data.guildId,
    content: data.content,
    imageName: data.image?.name ?? null,
    imageData: data.image ? new Uint8Array(data.image.data) : null,
    expiresAt: data.expiresAt,
  };
  await db.guild.upsert({
    where: { id: data.guildId },
    create: { id: data.guildId },
    update: {},
  });
  // A new sticky in a channel that already has one replaces it.
  const sticky = await db.stickyMessage.upsert({
    where: { channelId: data.channelId },
    create: { channelId: data.channelId, ...fields },
    update: fields,
  });
  stickyChannels.add(sticky.channelId);
  return sticky;
}

export function setLastMessage(id: number, lastMessageId: string | null) {
  return db.stickyMessage.update({ where: { id }, data: { lastMessageId } });
}

export async function deleteStickyRow(id: number) {
  const sticky = await db.stickyMessage.delete({ where: { id } });
  stickyChannels.delete(sticky.channelId);
}

export function expiredStickies() {
  return db.stickyMessage.findMany({ where: { expiresAt: { lte: new Date() } } });
}

export function countStickies(guildId: string) {
  return db.stickyMessage.count({ where: { guildId } });
}
