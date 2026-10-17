import type { BotModule } from '../../core/types.js';
import { welcomeSection } from './config.js';
import { memberJoined, memberPassedScreening } from './events.js';

export const welcomeModule: BotModule = {
  id: 'welcome',
  name: 'Welcome',
  description: 'Welcome messages and auto roles for new members.',
  toggleable: true,
  enabledByDefault: true,
  commands: [],
  events: [memberJoined, memberPassedScreening],
  configSections: [welcomeSection],
};
