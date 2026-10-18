import type { BotModule } from '../../core/types.js';
import { memberCountCommand } from './membercount.js';

export const utilityModule: BotModule = {
  id: 'utility',
  name: 'Utility',
  description: 'Handy server info commands like /membercount.',
  toggleable: true,
  enabledByDefault: true,
  commands: [memberCountCommand],
  events: [],
};
