import type { GuildMember } from 'discord.js';
import { db } from '../../core/db.js';

export const DEFAULT_WELCOME_MESSAGE =
  '👋 Welcome to **{server}**, {user}! You are member number {membercount}.';

/** The most auto roles a server can pick. */
export const MAX_AUTO_ROLES = 10;

export async function getWelcomeSettings(guildId: string) {
  const row = await db.welcomeSettings.findUnique({ where: { guildId } });
  return { channelId: row?.channelId ?? null, message: row?.message ?? null };
}

export async function updateWelcomeSettings(
  guildId: string,
  changes: { channelId?: string | null; message?: string | null },
) {
  await db.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await db.welcomeSettings.upsert({
    where: { guildId },
    create: { guildId, ...changes },
    update: changes,
  });
}

export async function getAutoRoles(guildId: string) {
  const rows = await db.autoRole.findMany({ where: { guildId }, select: { roleId: true } });
  return rows.map((r) => r.roleId);
}

export async function setAutoRoles(guildId: string, roleIds: string[]) {
  await db.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await db.$transaction([
    db.autoRole.deleteMany({ where: { guildId } }),
    db.autoRole.createMany({ data: roleIds.map((roleId) => ({ guildId, roleId })) }),
  ]);
}

/** Fills in {user}, {username}, {server} and {membercount}. */
export function fillWelcomeMessage(template: string, member: GuildMember) {
  return template
    .replaceAll('{user}', `${member}`)
    .replaceAll('{username}', member.user.username)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{membercount}', String(member.guild.memberCount));
}
