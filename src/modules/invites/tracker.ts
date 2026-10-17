import { PermissionFlagsBits, type Guild, type Invite } from 'discord.js';
import { logger } from '../../core/logger.js';

// Discord doesn't say which invite a new member used. Instead we remember how many times
// each invite has been used, and when someone joins, the invite whose count went up is theirs.

interface CachedInvite {
  uses: number;
  maxUses: number;
  inviterId: string | null;
}

/** guild id → invite code → its last known use count. */
const cache = new Map<string, Map<string, CachedInvite>>();

function toCached(invite: Invite): CachedInvite {
  return {
    uses: invite.uses ?? 0,
    maxUses: invite.maxUses ?? 0,
    inviterId: invite.inviterId ?? null,
  };
}

/** Whether the bot can see invites here. Reading them needs the Manage Server permission. */
export function canTrack(guild: Guild) {
  return guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild) ?? false;
}

async function fetchInvites(guild: Guild) {
  if (!canTrack(guild)) return null;
  try {
    const invites = await guild.invites.fetch();
    return new Map(invites.map((invite) => [invite.code, toCached(invite)]));
  } catch (err) {
    logger.warn(`Couldn't read invites in ${guild.name}`, err);
    return null;
  }
}

export async function cacheGuildInvites(guild: Guild) {
  const invites = await fetchInvites(guild);
  if (invites) cache.set(guild.id, invites);
}

export function rememberInvite(invite: Invite) {
  if (!invite.guild) return;
  const invites = cache.get(invite.guild.id) ?? new Map<string, CachedInvite>();
  invites.set(invite.code, toCached(invite));
  cache.set(invite.guild.id, invites);
}

export function forgetInvite(guildId: string, code: string) {
  cache.get(guildId)?.delete(code);
}

/** Works out which invite a member who just joined used. Null if it can't be told. */
export async function findUsedInvite(
  guild: Guild,
): Promise<{ code: string; inviterId: string | null } | null> {
  const before = cache.get(guild.id);
  const after = await fetchInvites(guild);
  if (!after) return null;
  cache.set(guild.id, after);
  if (!before) return null;

  for (const [code, invite] of after) {
    if (invite.uses > (before.get(code)?.uses ?? 0)) return { code, inviterId: invite.inviterId };
  }
  // A limited invite that just hit its last use is deleted by Discord, so it's gone now.
  for (const [code, invite] of before) {
    if (!after.has(code) && invite.maxUses > 0 && invite.uses + 1 >= invite.maxUses) {
      return { code, inviterId: invite.inviterId };
    }
  }
  return null;
}
