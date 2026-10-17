import { Events } from 'discord.js';
import { logger } from '../../core/logger.js';
import { isModuleEnabled } from '../../core/settings.js';
import { defineEvent } from '../../core/types.js';
import { recordJoin, recordLeave } from './store.js';
import { cacheGuildInvites, findUsedInvite, forgetInvite, rememberInvite } from './tracker.js';

export const cacheInvitesOnStartup = defineEvent({
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    await Promise.all(client.guilds.cache.map((guild) => cacheGuildInvites(guild)));
    logger.info('Invite counts cached');
  },
});

export const cacheInvitesOnGuildJoin = defineEvent({
  name: Events.GuildCreate,
  execute: (guild) => cacheGuildInvites(guild),
});

export const inviteCreated = defineEvent({
  name: Events.InviteCreate,
  execute: (invite) => rememberInvite(invite),
});

export const inviteDeleted = defineEvent({
  name: Events.InviteDelete,
  execute(invite) {
    if (invite.guild) forgetInvite(invite.guild.id, invite.code);
  },
});

export const trackJoin = defineEvent({
  name: Events.GuildMemberAdd,
  async execute(member) {
    // Always check, so the use counts stay right even while the module is off.
    const used = await findUsedInvite(member.guild);
    if (member.user.bot || !(await isModuleEnabled(member.guild.id, 'invites'))) return;
    await recordJoin(member.guild.id, member.id, {
      inviterId: used?.inviterId ?? null,
      code: used?.code ?? null,
    });
  },
});

export const trackLeave = defineEvent({
  name: Events.GuildMemberRemove,
  execute: (member) => recordLeave(member.guild.id, member.id),
});
