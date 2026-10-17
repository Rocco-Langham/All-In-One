import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { errorEmbed } from './embeds.js';
import { themeColor } from './theme.js';
import { BOT_VERSION } from './version.js';
import { allConfigSections, findConfigSection } from './registry.js';
import type { ComponentHandler, ConfigSection, ConfigView, PanelInteraction } from './types.js';

// Custom ids: config:open:<section> (a page button), config:home (back button),
// config:<section>:<action> (handled by that section).
const OPEN_PREFIX = 'config:open:';
const HOME_ID = 'config:home';
/** Discord allows at most 5 buttons in one row. */
const BUTTONS_PER_ROW = 5;

/** Turns a page into message options. The /config pages use Discord's container layout. */
export function asMessage(view: ConfigView) {
  return { components: view.components, flags: MessageFlags.IsComponentsV2 } as const;
}

/**
 * The first page of /config: a row of buttons, one per settings page. A page marked
 * `cornerIcon` is shown instead as an icon-only button in the top-right corner.
 */
export function homeView(guildId: string): ConfigView {
  const all = allConfigSections();
  const corner = all.find((s) => s.cornerIcon);
  const sections = all.filter((s) => !s.cornerIcon);
  const list = sections
    .map((s) => `${s.emoji ? `${s.emoji} ` : ''}**${s.label}**: ${s.description}`)
    .join('\n');
  // Discord can't place text right beside a button, so the version goes on the last line
  // next to the ⚙️ button, in small text.
  const title = `## Server settings\nPick what you want to set up.\n-# v${BOT_VERSION}`;

  const container = new ContainerBuilder().setAccentColor(themeColor(guildId));
  const cornerIcon = corner?.cornerIcon;
  // Only the title sits beside the corner button. The list goes underneath on its own so it
  // gets the full width of the box instead of wrapping next to the button.
  if (corner && cornerIcon) {
    container.addSectionComponents((section) =>
      section
        .addTextDisplayComponents((t) => t.setContent(title))
        .setButtonAccessory((b) =>
          b
            .setCustomId(`${OPEN_PREFIX}${corner.id}`)
            .setEmoji({ name: cornerIcon })
            .setStyle(ButtonStyle.Secondary),
        ),
    );
  } else {
    container.addTextDisplayComponents((t) => t.setContent(title));
  }
  container.addTextDisplayComponents((t) => t.setContent(list));

  const buttons = sections.map((section) => {
    const button = new ButtonBuilder()
      .setCustomId(`${OPEN_PREFIX}${section.id}`)
      .setLabel(section.label)
      .setStyle(ButtonStyle.Primary);
    if (section.emoji) button.setEmoji(section.emoji);
    return button;
  });
  for (let i = 0; i < buttons.length; i += BUTTONS_PER_ROW) {
    container.addActionRowComponents(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        buttons.slice(i, i + BUTTONS_PER_ROW),
      ),
    );
  }

  return { components: [container] };
}

/** Renders a settings page with a Back button underneath. */
export async function sectionView(section: ConfigSection, guildId: string): Promise<ConfigView> {
  const view = await section.render(guildId);
  const back = new ButtonBuilder()
    .setCustomId(HOME_ID)
    .setLabel('Back')
    .setEmoji('⬅️')
    .setStyle(ButtonStyle.Secondary);
  return {
    components: [
      ...view.components,
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(back),
    ],
  };
}

/** Redraws a settings page in place after one of its buttons or popups was used. */
export async function showSection(
  interaction: PanelInteraction,
  section: ConfigSection,
  guildId: string,
) {
  const message = asMessage(await sectionView(section, guildId));
  if (interaction.isMessageComponent()) await interaction.update(message);
  else if (interaction.isFromMessage()) await interaction.update(message);
}

export const configComponents: ComponentHandler = {
  prefix: 'config:',
  async execute(interaction) {
    if (!interaction.inGuild()) return;
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        embeds: [errorEmbed('You need the **Manage Server** permission to change settings.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.isMessageComponent() && interaction.customId === HOME_ID) {
      await interaction.update(asMessage(homeView(interaction.guildId)));
      return;
    }

    if (interaction.customId.startsWith(OPEN_PREFIX)) {
      const section = findConfigSection(interaction.customId.slice(OPEN_PREFIX.length));
      if (section) await showSection(interaction, section, interaction.guildId);
      return;
    }

    const [, sectionId = '', ...action] = interaction.customId.split(':');
    const section = findConfigSection(sectionId);
    await section?.handle?.(interaction, action.join(':'), interaction.guildId);
  },
};
