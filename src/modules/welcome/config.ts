import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  RoleSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { showSection } from '../../core/configPanel.js';
import { errorEmbed, successEmbed } from '../../core/embeds.js';
import { themeColor } from '../../core/theme.js';
import { isModuleEnabled } from '../../core/settings.js';
import type { ConfigSection } from '../../core/types.js';
import { sendWelcome } from './join.js';
import {
  DEFAULT_WELCOME_MESSAGE,
  getAutoRoles,
  getWelcomeSettings,
  MAX_AUTO_ROLES,
  setAutoRoles,
  updateWelcomeSettings,
} from './settings.js';

// Custom ids handled here (after config:welcome:):
//   setchannel    the welcome channel picker
//   edit          "Edit message" button, opens the popup
//   save          the message popup being submitted
//   test          "Send test" button
//   setroles      the auto role picker
const MESSAGE_INPUT_ID = 'message';

function row(component: MessageActionRowComponentBuilder) {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(component);
}

export const welcomeSection: ConfigSection = {
  id: 'welcome',
  label: 'Welcome',
  description: 'Welcome messages and auto roles.',
  emoji: '👋',

  async render(guildId) {
    const on = await isModuleEnabled(guildId, 'welcome');
    const { channelId, message } = await getWelcomeSettings(guildId);
    const roleIds = await getAutoRoles(guildId);

    const channelPicker = new ChannelSelectMenuBuilder()
      .setCustomId('config:welcome:setchannel')
      .setPlaceholder('Choose the welcome channel…')
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(0)
      .setMaxValues(1);
    if (channelId) channelPicker.setDefaultChannels(channelId);

    const rolePicker = new RoleSelectMenuBuilder()
      .setCustomId('config:welcome:setroles')
      .setPlaceholder('Choose roles to give new members…')
      .setMinValues(0)
      .setMaxValues(MAX_AUTO_ROLES);
    if (roleIds.length > 0) rolePicker.setDefaultRoles(roleIds);

    const preview = (message ?? DEFAULT_WELCOME_MESSAGE).replaceAll('\n', '\n> ');

    const container = new ContainerBuilder()
      .setAccentColor(themeColor(guildId))
      .addTextDisplayComponents((t) =>
        t.setContent(
          `## 👋 Welcome\nModule status: ${on ? '🟢 On' : '🔴 Off'}\n` +
            '### Welcome message\n' +
            'Posted when someone joins the server. Leave the channel empty to turn it off.\n' +
            `**Channel:** ${channelId ? `<#${channelId}>` : 'Off'}`,
        ),
      )
      .addActionRowComponents(row(channelPicker))
      .addSectionComponents((section) =>
        section
          .addTextDisplayComponents((t) => t.setContent(`> ${preview}`))
          .setButtonAccessory((b) =>
            b
              .setCustomId('config:welcome:edit')
              .setLabel('Edit message')
              .setEmoji({ name: '✏️' })
              .setStyle(ButtonStyle.Primary),
          ),
      )
      .addActionRowComponents(
        row(
          new ButtonBuilder()
            .setCustomId('config:welcome:test')
            .setLabel('Send test')
            .setEmoji('📨')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!channelId),
        ),
      )
      .addTextDisplayComponents((t) =>
        t.setContent('-# You can use {user}, {username}, {server} and {membercount}.'),
      )
      .addSeparatorComponents((s) => s)
      .addTextDisplayComponents((t) =>
        t.setContent(
          '### 🎭 Auto role\n' +
            'Given to every new member when they join. Leave it empty to turn it off.\n' +
            `**Roles:** ${roleIds.length > 0 ? roleIds.map((id) => `<@&${id}>`).join(', ') : 'None'}`,
        ),
      )
      .addActionRowComponents(row(rolePicker));

    return { components: [container] };
  },

  async handle(interaction, action, guildId) {
    if (action === 'setchannel' && interaction.isChannelSelectMenu()) {
      await updateWelcomeSettings(guildId, { channelId: interaction.values[0] ?? null });
      await showSection(interaction, welcomeSection, guildId);
      return;
    }

    if (action === 'setroles' && interaction.isRoleSelectMenu() && interaction.inCachedGuild()) {
      await setAutoRoles(guildId, interaction.values);
      await showSection(interaction, welcomeSection, guildId);

      // Warn about roles the bot isn't allowed to hand out.
      const me = interaction.guild.members.me;
      const blocked = interaction.roles.filter(
        (role) => role.managed || !me || role.position >= me.roles.highest.position,
      );
      if (blocked.size > 0) {
        await interaction.followUp({
          embeds: [
            errorEmbed(
              `I can't give ${blocked.map((r) => `${r}`).join(', ')}. ` +
                'Move my role above it in Server Settings → Roles, ' +
                'and make sure I have the **Manage Roles** permission.',
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    if (action === 'edit' && interaction.isButton()) {
      const { message } = await getWelcomeSettings(guildId);
      const input = new TextInputBuilder()
        .setCustomId(MESSAGE_INPUT_ID)
        .setLabel('Welcome message')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(message ?? DEFAULT_WELCOME_MESSAGE)
        .setRequired(true)
        .setMaxLength(1500);
      const modal = new ModalBuilder()
        .setCustomId('config:welcome:save')
        .setTitle('Welcome message')
        .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
      return;
    }

    if (action === 'save' && interaction.isModalSubmit()) {
      const message = interaction.fields.getTextInputValue(MESSAGE_INPUT_ID).trim();
      await updateWelcomeSettings(guildId, { message });
      await showSection(interaction, welcomeSection, guildId);
      return;
    }

    if (action === 'test' && interaction.isButton() && interaction.inCachedGuild()) {
      // Sends the real welcome message, using whoever clicked as the new member.
      const sent = await sendWelcome(interaction.member);
      await interaction.reply({
        embeds: [
          sent
            ? successEmbed(guildId, 'Test welcome message sent.')
            : errorEmbed(
                "I couldn't send it. Check that I can see and send messages in that channel.",
              ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
