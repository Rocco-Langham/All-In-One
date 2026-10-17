import type { BotModule } from '../../core/types.js';
import { allWarningsCommand, allWarningsPager } from './commands/allwarnings.js';
import { unwarnCommand } from './commands/unwarn.js';
import { warnCommand } from './commands/warn.js';
import { warningsCommand } from './commands/warnings.js';
import { warningsSection } from './config.js';

export const warningsModule: BotModule = {
  id: 'warnings',
  name: 'Warnings',
  description: 'Warn members and keep track of their warnings.',
  toggleable: true,
  enabledByDefault: true,
  commands: [warnCommand, unwarnCommand, warningsCommand, allWarningsCommand],
  events: [],
  components: [allWarningsPager],
  configSections: [warningsSection],
};
