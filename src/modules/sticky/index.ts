import type { BotModule } from '../../core/types.js';
import { stickySection } from './config.js';
import { stickyOnMessage, stickyStartup } from './events.js';

export const stickyModule: BotModule = {
  id: 'sticky',
  name: 'Sticky messages',
  description: 'Messages that stay at the bottom of a channel.',
  toggleable: true,
  enabledByDefault: true,
  commands: [],
  events: [stickyStartup, stickyOnMessage],
  configSections: [stickySection],
};
