import { PermissionFlagsBits, type GuildMember } from 'discord.js';
import { db } from './db.js';

/** Roles allowed to use the bot's commands. Empty = everyone. */
export async function getCommandRoles(guildId: string) {
  const rows = await db.commandRole.findMany({ where: { guildId }, select: { roleId: true } });
  return rows.map((r) => r.roleId);
}

export async function setCommandRoles(guildId: string, roleIds: string[]) {
  await db.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await db.$transaction([
    db.commandRole.deleteMany({ where: { guildId } }),
    db.commandRole.createMany({ data: roleIds.map((roleId) => ({ guildId, roleId })) }),
  ]);
}

/**
 * Whether a member may use the bot's commands at all. Admins and the owner always can, so
 * nobody can lock themselves out. Each command's own permission checks still apply on top.
 */
export async function canUseCommands(member: GuildMember) {
  if (member.id === member.guild.ownerId) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const roleIds = await getCommandRoles(member.guild.id);
  return roleIds.length === 0 || member.roles.cache.hasAny(...roleIds);
}
