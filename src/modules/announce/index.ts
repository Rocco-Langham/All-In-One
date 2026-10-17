import type { BotModule } from '../../core/types.js';
import { announceCommand } from './announce.js';

export const announceModule: BotModule = {
  id: 'announce',
  name: 'Announcements',
  description: 'Post announcements with /announce.',
  toggleable: true,
  enabledByDefault: true,
  commands: [announceCommand],
  events: [],
};
