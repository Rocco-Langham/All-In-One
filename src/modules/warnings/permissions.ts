import { PermissionFlagsBits, type GuildMember } from 'discord.js';
import { getWarnRoles } from './warnings.js';

/**
 * Whether a member may give or remove warnings: admins and the owner always can; otherwise
 * they need one of the roles from Warning config, or Timeout Members if no roles are set.
 */
export async function canManageWarnings(member: GuildMember) {
  if (member.id === member.guild.ownerId) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  const allowedRoles = await getWarnRoles(member.guild.id);
  return allowedRoles.length > 0
    ? member.roles.cache.hasAny(...allowedRoles)
    : member.permissions.has(PermissionFlagsBits.ModerateMembers);
}
