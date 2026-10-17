import { ButtonStyle, ContainerBuilder } from 'discord.js';
import { showSection } from '../../../core/configPanel.js';
import { themeColor } from '../../../core/theme.js';
import { getModule, getModules } from '../../../core/registry.js';
import { isModuleEnabled, setModuleEnabled } from '../../../core/settings.js';
import type { ConfigSection } from '../../../core/types.js';

export const modulesSection: ConfigSection = {
  id: 'modules',
  label: 'Modules',
  description: 'Turn features on or off.',
  emoji: '🧩',

  async render(guildId) {
    const container = new ContainerBuilder()
      .setAccentColor(themeColor(guildId))
      .addTextDisplayComponents((t) =>
        t.setContent('## 🧩 Modules\nTurn whole feature areas on or off.'),
      )
      .addSeparatorComponents((s) => s);

    for (const mod of getModules()) {
      if (!mod.toggleable) {
        container.addTextDisplayComponents((t) =>
          t.setContent(`🔒 **${mod.name}** (always on)\n${mod.description}`),
        );
        continue;
      }
      const on = await isModuleEnabled(guildId, mod.id);
      container.addSectionComponents((section) =>
        section
          .addTextDisplayComponents((t) =>
            t.setContent(`${on ? '🟢' : '🔴'} **${mod.name}**\n${mod.description}`),
          )
          .setButtonAccessory((b) =>
            b
              .setCustomId(`config:modules:toggle:${mod.id}`)
              .setLabel(on ? 'Turn off' : 'Turn on')
              .setStyle(on ? ButtonStyle.Danger : ButtonStyle.Success),
          ),
      );
    }

    return { components: [container] };
  },

  async handle(interaction, action, guildId) {
    const [verb, moduleId = ''] = action.split(':');
    if (verb !== 'toggle') return;
    const mod = getModule(moduleId);
    if (!mod?.toggleable) return;

    await setModuleEnabled(guildId, mod.id, !(await isModuleEnabled(guildId, mod.id)));
    await showSection(interaction, modulesSection, guildId);
  },
};
