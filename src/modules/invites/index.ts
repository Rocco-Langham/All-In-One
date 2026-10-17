import type { BotModule } from '../../core/types.js';
import { inviteTrackCommand } from './command.js';
import {
  cacheInvitesOnGuildJoin,
  cacheInvitesOnStartup,
  inviteCreated,
  inviteDeleted,
  trackJoin,
  trackLeave,
} from './events.js';

export const invitesModule: BotModule = {
  id: 'invites',
  name: 'Invite tracking',
  description: 'Counts how many people each member invites.',
  toggleable: true,
  enabledByDefault: true,
  commands: [inviteTrackCommand],
  events: [
    cacheInvitesOnStartup,
    cacheInvitesOnGuildJoin,
    inviteCreated,
    inviteDeleted,
    trackJoin,
    trackLeave,
  ],
};
