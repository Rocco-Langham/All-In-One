import type { Client, Guild } from 'discord.js';

/** The logged-in client, for code that only has a server id (like /config pages). */
let current: Client<true> | null = null;

export function setClient(client: Client<true>) {
  current = client;
}

export function getGuild(guildId: string): Guild | undefined {
  return current?.guilds.cache.get(guildId);
}
