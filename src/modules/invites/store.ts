import { db } from '../../core/db.js';

export async function recordJoin(
  guildId: string,
  memberId: string,
  invite: { inviterId: string | null; code: string | null },
) {
  await db.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  const data = { ...invite, joinedAt: new Date(), left: false };
  await db.inviteJoin.upsert({
    where: { guildId_memberId: { guildId, memberId } },
    create: { guildId, memberId, ...data },
    update: data,
  });
}

export async function recordLeave(guildId: string, memberId: string) {
  await db.inviteJoin.updateMany({ where: { guildId, memberId }, data: { left: true } });
}

export interface InviteStats {
  inviterId: string;
  joined: number;
  left: number;
  /** Members still in the server: what the leaderboard ranks by. */
  total: number;
}

function toStats(inviterId: string, joined: number, left: number): InviteStats {
  return { inviterId, joined, left, total: joined - left };
}

export async function statsFor(guildId: string, inviterId: string): Promise<InviteStats> {
  const [joined, left] = await Promise.all([
    db.inviteJoin.count({ where: { guildId, inviterId } }),
    db.inviteJoin.count({ where: { guildId, inviterId, left: true } }),
  ]);
  return toStats(inviterId, joined, left);
}

export async function leaderboard(guildId: string): Promise<InviteStats[]> {
  const [joined, left] = await Promise.all([
    db.inviteJoin.groupBy({
      by: ['inviterId'],
      where: { guildId, inviterId: { not: null } },
      _count: { _all: true },
    }),
    db.inviteJoin.groupBy({
      by: ['inviterId'],
      where: { guildId, inviterId: { not: null }, left: true },
      _count: { _all: true },
    }),
  ]);
  const leftBy = new Map(left.map((r) => [r.inviterId, r._count._all]));
  return joined
    .filter((r): r is typeof r & { inviterId: string } => r.inviterId !== null)
    .map((r) => toStats(r.inviterId, r._count._all, leftBy.get(r.inviterId) ?? 0))
    .sort((a, b) => b.total - a.total || b.joined - a.joined);
}

export function recentInvites(guildId: string, inviterId: string, take: number) {
  return db.inviteJoin.findMany({
    where: { guildId, inviterId },
    orderBy: { joinedAt: 'desc' },
    take,
    select: { memberId: true, left: true },
  });
}
