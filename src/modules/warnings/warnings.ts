import { db } from '../../core/db.js';

export function countWarnings(guildId: string, userId?: string) {
  return db.warning.count({ where: { guildId, userId } });
}

export async function addWarning(
  guildId: string,
  userId: string,
  moderatorId: string,
  details: { reason: string | null; level: number; timeoutMinutes: number },
) {
  await db.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await db.warning.create({ data: { guildId, userId, moderatorId, ...details } });
}

/** A member's most recent warning, or a specific one by its # if `id` is given. */
export function findWarning(guildId: string, userId: string, id?: number) {
  return db.warning.findFirst({
    where: { guildId, userId, id },
    orderBy: { createdAt: 'desc' },
  });
}

export async function isLatestWarning(guildId: string, userId: string, id: number) {
  return (await findWarning(guildId, userId))?.id === id;
}

export function deleteWarning(id: number) {
  return db.warning.delete({ where: { id } });
}

/** One page of the server's warnings, newest first. Pass `userId` for one member's only. */
export function listWarnings(guildId: string, page: number, pageSize: number, userId?: string) {
  return db.warning.findMany({
    where: { guildId, userId },
    orderBy: { createdAt: 'desc' },
    skip: page * pageSize,
    take: pageSize,
  });
}

/** Roles allowed to give warnings. Empty = anyone with the Timeout Members permission. */
export async function getWarnRoles(guildId: string) {
  const rows = await db.warningRole.findMany({ where: { guildId }, select: { roleId: true } });
  return rows.map((r) => r.roleId);
}

export async function setWarnRoles(guildId: string, roleIds: string[]) {
  await db.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await db.$transaction([
    db.warningRole.deleteMany({ where: { guildId } }),
    db.warningRole.createMany({ data: roleIds.map((roleId) => ({ guildId, roleId })) }),
  ]);
}
