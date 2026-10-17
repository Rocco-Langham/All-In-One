import type { BotModule } from '../../core/types.js';
import { purgeCommand } from './purge.js';

export const moderationModule: BotModule = {
  id: 'moderation',
  name: 'Moderation',
  description: 'Moderation tools like /purge.',
  toggleable: true,
  enabledByDefault: true,
  commands: [purgeCommand],
  events: [],
};
