import { Events } from 'discord.js';
import { isModuleEnabled } from '../../core/settings.js';
import { defineEvent } from '../../core/types.js';
import { giveAutoRoles, sendWelcome } from './join.js';

export const memberJoined = defineEvent({
  name: Events.GuildMemberAdd,
  async execute(member) {
    if (member.user.bot || !(await isModuleEnabled(member.guild.id, 'welcome'))) return;
    await sendWelcome(member);
    // Members still going through the server's rules screen can't get roles yet;
    // they get them in memberPassedScreening below.
    if (!member.pending) await giveAutoRoles(member);
  },
});

export const memberPassedScreening = defineEvent({
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    if (!oldMember.pending || newMember.pending || newMember.user.bot) return;
    if (!(await isModuleEnabled(newMember.guild.id, 'welcome'))) return;
    await giveAutoRoles(newMember);
  },
});
