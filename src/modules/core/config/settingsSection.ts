import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  RoleSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { getCommandRoles, setCommandRoles } from '../../../core/access.js';
import { getGuild } from '../../../core/client.js';
import { asMessage, showSection } from '../../../core/configPanel.js';
import { errorEmbed } from '../../../core/embeds.js';
import {
  DEFAULT_THEME_COLOR,
  hex,
  parseHex,
  setThemeColor,
  themeColor,
  THEMES,
} from '../../../core/theme.js';
import type { ConfigSection, ConfigView } from '../../../core/types.js';

// Custom ids handled here (after config:settings:):
//   theme:<id>    a theme button
//   custom        "Custom colour" button, opens the popup
//   customsave    the popup being submitted
//   reset         back to the default theme
//   nick          "Change Nickname" button, opens the popup
//   nicksave      the nickname popup being submitted
//   access        Command access → Roles button, opens the roles page
//   setaccess     the role picker on that page
//   main          back from the roles page to Settings
const HEX_INPUT_ID = 'hex';
const NICK_INPUT_ID = 'nickname';
/** Discord's longest allowed nickname. */
const MAX_NICKNAME = 32;
const BUTTONS_PER_ROW = 5;

function whoCanUse(roleIds: string[]) {
  return roleIds.length > 0 ? roleIds.map((id) => `<@&${id}>`).join(', ') : 'Everyone';
}

/** The page reached from Command access → Roles: pick which roles can use commands. */
async function accessView(guildId: string): Promise<ConfigView> {
  const roleIds = await getCommandRoles(guildId);

  const picker = new RoleSelectMenuBuilder()
    .setCustomId('config:settings:setaccess')
    .setPlaceholder('Choose the roles that can use commands…')
    .setMinValues(0)
    .setMaxValues(25);
  if (roleIds.length > 0) picker.setDefaultRoles(roleIds);

  const container = new ContainerBuilder()
    .setAccentColor(themeColor(guildId))
    .addTextDisplayComponents((t) =>
      t.setContent(
        '## 🔐 Command access\n' +
          'Only members with one of these roles can use my commands. ' +
          'Leave it empty to let everyone use them.\n' +
          '-# Admins and the server owner can always use commands, so you can’t lock yourself ' +
          'out. Commands that need a permission, like /purge, still need it too.\n\n' +
          `**Who can use commands:** ${whoCanUse(roleIds)}`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(picker),
    );

  const back = new ButtonBuilder()
    .setCustomId('config:settings:main')
    .setLabel('Back to Settings')
    .setEmoji('⬅️')
    .setStyle(ButtonStyle.Secondary);

  return {
    components: [
      container,
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(back),
    ],
  };
}

function themeName(color: number) {
  const theme = THEMES.find((t) => t.color === color);
  return theme ? `${theme.emoji} ${theme.label}` : '🎨 Custom';
}

export const settingsSection: ConfigSection = {
  id: 'settings',
  label: 'Settings',
  description: "The bot's colour theme, nickname and who can use commands.",
  emoji: '⚙️',
  cornerIcon: '⚙️',

  async render(guildId) {
    const current = themeColor(guildId);

    const container = new ContainerBuilder()
      .setAccentColor(current)
      .addTextDisplayComponents((t) =>
        t.setContent(
          '## ⚙️ Settings\n' +
            '### 🎨 Colour theme\n' +
            "Changes the colour of the bot's menus and messages in this server. " +
            'Error messages always stay red.\n' +
            `**Current:** ${themeName(current)} (\`${hex(current)}\`)`,
        ),
      );

    const buttons = THEMES.map((theme) =>
      new ButtonBuilder()
        .setCustomId(`config:settings:theme:${theme.id}`)
        .setLabel(theme.label)
        .setEmoji(theme.emoji)
        .setStyle(theme.color === current ? ButtonStyle.Primary : ButtonStyle.Secondary),
    );
    for (let i = 0; i < buttons.length; i += BUTTONS_PER_ROW) {
      container.addActionRowComponents(
        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
          buttons.slice(i, i + BUTTONS_PER_ROW),
        ),
      );
    }

    container.addActionRowComponents(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('config:settings:custom')
          .setLabel('Custom colour')
          .setEmoji('🎨')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('config:settings:reset')
          .setLabel('Reset to default')
          .setEmoji('↩️')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(current === DEFAULT_THEME_COLOR),
      ),
    );

    const me = getGuild(guildId)?.members.me;
    const nickname = me?.nickname ?? null;
    container
      .addSeparatorComponents((s) => s)
      .addSectionComponents((section) =>
        section
          .addTextDisplayComponents((t) =>
            t.setContent(
              '### 🏷️ Nickname\n' +
                "The bot's name in this server.\n" +
                `**Current:** ${nickname ? `**${nickname}**` : `${me?.user.username ?? 'Default'} (no nickname)`}`,
            ),
          )
          .setButtonAccessory((b) =>
            b
              .setCustomId('config:settings:nick')
              .setLabel('Change Nickname')
              .setEmoji({ name: '✏️' })
              .setStyle(ButtonStyle.Primary),
          ),
      );

    const accessRoles = await getCommandRoles(guildId);
    container
      .addSeparatorComponents((s) => s)
      .addSectionComponents((section) =>
        section
          .addTextDisplayComponents((t) =>
            t.setContent(
              '### 🔐 Command access\n' +
                "Who can use the bot's commands.\n" +
                `**Current:** ${whoCanUse(accessRoles)}`,
            ),
          )
          .setButtonAccessory((b) =>
            b
              .setCustomId('config:settings:access')
              .setLabel('Roles')
              .setEmoji({ name: '🛡️' })
              .setStyle(ButtonStyle.Primary),
          ),
      );

    return { components: [container] };
  },

  async handle(interaction, action, guildId) {
    const [verb, themeId] = action.split(':');

    if (verb === 'access' && interaction.isButton()) {
      await interaction.update(asMessage(await accessView(guildId)));
      return;
    }

    if (verb === 'setaccess' && interaction.isRoleSelectMenu()) {
      await setCommandRoles(guildId, interaction.values);
      await interaction.update(asMessage(await accessView(guildId)));
      return;
    }

    if (verb === 'main') {
      await showSection(interaction, settingsSection, guildId);
      return;
    }

    if (verb === 'theme') {
      const theme = THEMES.find((t) => t.id === themeId);
      if (!theme) return;
      await setThemeColor(guildId, theme.color);
      await showSection(interaction, settingsSection, guildId);
      return;
    }

    if (verb === 'reset') {
      await setThemeColor(guildId, null);
      await showSection(interaction, settingsSection, guildId);
      return;
    }

    if (verb === 'nick' && interaction.isButton()) {
      const input = new TextInputBuilder()
        .setCustomId(NICK_INPUT_ID)
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(MAX_NICKNAME);
      const nickname = getGuild(guildId)?.members.me?.nickname;
      if (nickname) input.setValue(nickname);
      const modal = new ModalBuilder()
        .setCustomId('config:settings:nicksave')
        .setTitle('Change Nickname')
        .addLabelComponents((l) =>
          l
            .setLabel('Nickname')
            .setDescription('Leave empty to go back to the normal name')
            .setTextInputComponent(input),
        );
      await interaction.showModal(modal);
      return;
    }

    if (verb === 'nicksave' && interaction.isModalSubmit()) {
      const nickname = interaction.fields.getTextInputValue(NICK_INPUT_ID).trim() || null;
      const me = getGuild(guildId)?.members.me;
      try {
        if (!me) throw new Error('Bot member not cached');
        await me.setNickname(nickname, `Changed in /config by ${interaction.user.tag}`);
      } catch {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "I couldn't change my nickname. Make sure I have the **Change Nickname** " +
                'permission in Server Settings → Roles.',
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await showSection(interaction, settingsSection, guildId);
      return;
    }

    if (verb === 'custom' && interaction.isButton()) {
      const modal = new ModalBuilder()
        .setCustomId('config:settings:customsave')
        .setTitle('Custom colour')
        .addLabelComponents((l) =>
          l
            .setLabel('Colour code')
            .setDescription('A hex colour code, like #FF8800')
            .setTextInputComponent((t) =>
              t
                .setCustomId(HEX_INPUT_ID)
                .setStyle(TextInputStyle.Short)
                .setValue(hex(themeColor(guildId)))
                .setRequired(true)
                .setMaxLength(7),
            ),
        );
      await interaction.showModal(modal);
      return;
    }

    if (verb === 'customsave' && interaction.isModalSubmit()) {
      const color = parseHex(interaction.fields.getTextInputValue(HEX_INPUT_ID));
      if (color === null) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              'That is not a colour code. Use a hex code like `#FF8800`. ' +
                'You can find one by searching "colour picker" online.',
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await setThemeColor(guildId, color);
      await showSection(interaction, settingsSection, guildId);
    }
  },
};
