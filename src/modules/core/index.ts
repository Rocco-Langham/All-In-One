import { Events } from 'discord.js';
import { setClient } from '../../core/client.js';
import { configComponents } from '../../core/configPanel.js';
import { loadThemes } from '../../core/theme.js';
import { defineEvent, type BotModule } from '../../core/types.js';
import { configCommand } from './commands/config.js';
import { helpCommand } from './commands/help.js';
import { pingCommand } from './commands/ping.js';
import { modulesSection } from './config/modulesSection.js';
import { settingsSection } from './config/settingsSection.js';

const onStartup = defineEvent({
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    setClient(client);
    await loadThemes();
  },
});

export const coreModule: BotModule = {
  id: 'core',
  name: 'Core',
  description: 'Help, status and server configuration.',
  toggleable: false,
  enabledByDefault: true,
  commands: [pingCommand, helpCommand, configCommand],
  events: [onStartup],
  components: [configComponents],
  configSections: [modulesSection, settingsSection],
};
