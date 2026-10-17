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
import { asMessage, showSection } from '../../core/configPanel.js';
import { formatDuration, parseDuration } from '../../core/duration.js';
import { errorEmbed } from '../../core/embeds.js';
import { themeColor } from '../../core/theme.js';
import { isModuleEnabled } from '../../core/settings.js';
import type { ConfigSection, ConfigView, PanelInteraction } from '../../core/types.js';
import { DEFAULT_ALERT_MESSAGE, getWarnSettings, updateWarnSettings } from './settings.js';
import { getWarnRoles, setWarnRoles } from './warnings.js';
import {
  addStep,
  getWarningSteps,
  MAX_STEPS,
  MAX_TIMEOUT_MINUTES,
  removeLastStep,
  setStepTimeout,
} from './steps.js';

// Custom ids handled here (after config:warnings:):
//   add, remove          ➕ / ➖ buttons under the list
//   edit:<level>         ⏱️ button next to a warning, opens the time popup
//   time:<level>         the popup being submitted
//   roles                "Roles" button, opens the roles page
//   setroles             the role picker on the roles page
//   main                 back from the roles or log page to the main page
//   log                  "Log and Alert" button, opens the log page
//   setlog               the log channel picker on the log page
//   setalertchannel      the alert channel picker on the log page
//   alertedit            "Edit alert" button, opens the alert popup
//   alertsave            the alert popup being submitted
//   alertoff             turns the alert off
const TIME_INPUT_ID = 'timeout';
const ALERT_LEVEL_INPUT_ID = 'level';
const ALERT_MESSAGE_INPUT_ID = 'message';
const MAX_ALERT_LEVEL = 100;

function backToMainRow() {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('config:warnings:main')
      .setLabel('Back to Warning config')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary),
  );
}

/** The page reached from the Log and Alert button. */
async function logView(guildId: string): Promise<ConfigView> {
  const { logChannelId, alertChannelId, alertLevel, alertMessage } = await getWarnSettings(guildId);
  const alertTarget = alertChannelId ?? logChannelId;

  const channelPicker = (id: string, placeholder: string, selected: string | null) => {
    const picker = new ChannelSelectMenuBuilder()
      .setCustomId(`config:warnings:${id}`)
      .setPlaceholder(placeholder)
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(0)
      .setMaxValues(1);
    if (selected) picker.setDefaultChannels(selected);
    return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(picker);
  };

  const alertText =
    alertLevel === null
      ? 'Alert is **off**.'
      : `When a member reaches **Warning ${alertLevel}**, this is posted:\n` +
        `> ${(alertMessage ?? DEFAULT_ALERT_MESSAGE).replaceAll('\n', '\n> ')}`;

  const container = new ContainerBuilder()
    .setAccentColor(themeColor(guildId))
    .addTextDisplayComponents((t) =>
      t.setContent(
        '## 📋 Log and Alert\n' +
          '### Log channel\n' +
          'Every warning given or removed is posted here.\n' +
          `**Channel:** ${logChannelId ? `<#${logChannelId}>` : 'Not set'}`,
      ),
    )
    .addActionRowComponents(channelPicker('setlog', 'Choose the log channel…', logChannelId))
    .addSeparatorComponents((s) => s)
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents((t) => t.setContent(`### 🚨 Alert\n${alertText}`))
        .setButtonAccessory((b) =>
          b
            .setCustomId('config:warnings:alertedit')
            .setLabel(alertLevel === null ? 'Set up alert' : 'Edit alert')
            .setEmoji({ name: '✏️' })
            .setStyle(ButtonStyle.Primary),
        ),
    );

  if (alertLevel !== null) {
    const where = alertChannelId
      ? `<#${alertChannelId}>`
      : logChannelId
        ? `Same as the log channel (<#${logChannelId}>)`
        : 'Not set';
    container
      .addTextDisplayComponents((t) =>
        t.setContent(
          `**Alert channel:** ${where}\n` +
            '-# Leave this empty to send the alert to the log channel.',
        ),
      )
      .addActionRowComponents(
        channelPicker('setalertchannel', 'Choose the alert channel…', alertChannelId),
      )
      .addActionRowComponents(
        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('config:warnings:alertoff')
            .setLabel('Turn alert off')
            .setEmoji('🔕')
            .setStyle(ButtonStyle.Danger),
        ),
      );
  }
  if (alertLevel !== null && !alertTarget) {
    container.addTextDisplayComponents((t) =>
      t.setContent(
        '-# ⚠️ Choose an alert channel or a log channel so the alert has somewhere to go.',
      ),
    );
  } else if (alertLevel !== null) {
    container.addTextDisplayComponents((t) =>
      t.setContent(
        '-# You can use {user}, {moderator}, {warning} and {reason} in the alert message.',
      ),
    );
  }

  return { components: [container, backToMainRow()] };
}

/** Redraws the log page after one of its controls was used. */
async function showLogView(interaction: PanelInteraction, guildId: string) {
  const message = asMessage(await logView(guildId));
  if (interaction.isMessageComponent()) await interaction.update(message);
  else if (interaction.isFromMessage()) await interaction.update(message);
}

function whoCanWarn(roleIds: string[]) {
  return roleIds.length > 0
    ? roleIds.map((id) => `<@&${id}>`).join(', ')
    : 'Anyone with the **Timeout Members** permission';
}

/** The page reached from the Roles button: pick which roles can use /warn. */
async function rolesView(guildId: string): Promise<ConfigView> {
  const roleIds = await getWarnRoles(guildId);

  const picker = new RoleSelectMenuBuilder()
    .setCustomId('config:warnings:setroles')
    .setPlaceholder('Choose the roles that can give warnings…')
    .setMinValues(0)
    .setMaxValues(25);
  if (roleIds.length > 0) picker.setDefaultRoles(roleIds);

  const container = new ContainerBuilder()
    .setAccentColor(themeColor(guildId))
    .addTextDisplayComponents((t) =>
      t.setContent(
        '## 🛡️ Warning roles\n' +
          'Only members with one of these roles can use `/warn`. ' +
          'Admins and the server owner can always warn.\n\n' +
          `**Who can warn:** ${whoCanWarn(roleIds)}`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(picker),
    );

  return { components: [container, backToMainRow()] };
}

export const warningsSection: ConfigSection = {
  id: 'warnings',
  label: 'Warning config',
  description: 'Punishments, roles and logs.',
  emoji: '⚠️',

  async render(guildId) {
    const on = await isModuleEnabled(guildId, 'warnings');
    const steps = await getWarningSteps(guildId);
    const roleIds = await getWarnRoles(guildId);

    const container = new ContainerBuilder()
      .setAccentColor(themeColor(guildId))
      .addTextDisplayComponents((t) =>
        t.setContent(
          `## ⚠️ Warning config\nModule status: ${on ? '🟢 On' : '🔴 Off'}\n` +
            `🛡️ **Who can warn:** ${whoCanWarn(roleIds)}\n` +
            'When a member reaches a warning, they get its punishment.',
        ),
      )
      .addSeparatorComponents((s) => s);

    for (const step of steps) {
      container.addSectionComponents((section) =>
        section
          .addTextDisplayComponents((t) =>
            t.setContent(
              `**Warning ${step.level}** = ${formatDuration(step.timeoutMinutes)} timeout`,
            ),
          )
          .setButtonAccessory((b) =>
            b
              .setCustomId(`config:warnings:edit:${step.level}`)
              .setEmoji({ name: '⏱️' })
              .setStyle(ButtonStyle.Secondary),
          ),
      );
    }

    // No separator above the buttons: with 10 warnings this page uses all 40 components
    // Discord allows in one message.
    container.addActionRowComponents(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('config:warnings:add')
          .setEmoji('➕')
          .setStyle(ButtonStyle.Success)
          .setDisabled(steps.length >= MAX_STEPS),
        new ButtonBuilder()
          .setCustomId('config:warnings:remove')
          .setEmoji('➖')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(steps.length <= 1),
        new ButtonBuilder()
          .setCustomId('config:warnings:roles')
          .setLabel('Roles')
          .setEmoji('🛡️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('config:warnings:log')
          .setLabel('Log and Alert')
          .setEmoji('📋')
          .setStyle(ButtonStyle.Primary),
      ),
    );

    return { components: [container] };
  },

  async handle(interaction, action, guildId) {
    const [verb, levelText = ''] = action.split(':');
    const level = Number(levelText);

    if (verb === 'add') {
      await addStep(guildId);
      await showSection(interaction, warningsSection, guildId);
      return;
    }

    if (verb === 'roles' && interaction.isButton()) {
      await interaction.update(asMessage(await rolesView(guildId)));
      return;
    }

    if (verb === 'setroles' && interaction.isRoleSelectMenu()) {
      await setWarnRoles(guildId, interaction.values);
      await interaction.update(asMessage(await rolesView(guildId)));
      return;
    }

    if (verb === 'log' && interaction.isButton()) {
      await showLogView(interaction, guildId);
      return;
    }

    if (verb === 'setlog' && interaction.isChannelSelectMenu()) {
      await updateWarnSettings(guildId, { logChannelId: interaction.values[0] ?? null });
      await showLogView(interaction, guildId);
      return;
    }

    if (verb === 'setalertchannel' && interaction.isChannelSelectMenu()) {
      await updateWarnSettings(guildId, { alertChannelId: interaction.values[0] ?? null });
      await showLogView(interaction, guildId);
      return;
    }

    if (verb === 'alertoff' && interaction.isButton()) {
      await updateWarnSettings(guildId, { alertLevel: null });
      await showLogView(interaction, guildId);
      return;
    }

    if (verb === 'alertedit' && interaction.isButton()) {
      const { alertLevel, alertMessage } = await getWarnSettings(guildId);
      const levelInput = new TextInputBuilder()
        .setCustomId(ALERT_LEVEL_INPUT_ID)
        .setLabel('Send the alert at warning number')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. 3')
        .setRequired(true)
        .setMaxLength(3);
      if (alertLevel !== null) levelInput.setValue(String(alertLevel));
      const messageInput = new TextInputBuilder()
        .setCustomId(ALERT_MESSAGE_INPUT_ID)
        .setLabel('Alert message')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(alertMessage ?? DEFAULT_ALERT_MESSAGE)
        .setRequired(true)
        .setMaxLength(1000);
      const modal = new ModalBuilder()
        .setCustomId('config:warnings:alertsave')
        .setTitle('Alert')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(levelInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput),
        );
      await interaction.showModal(modal);
      return;
    }

    if (verb === 'alertsave' && interaction.isModalSubmit()) {
      const levelText = interaction.fields.getTextInputValue(ALERT_LEVEL_INPUT_ID).trim();
      const alertLevel = Number(levelText);
      if (!/^\d+$/.test(levelText) || alertLevel < 1 || alertLevel > MAX_ALERT_LEVEL) {
        await interaction.reply({
          embeds: [
            errorEmbed(`The warning number must be a whole number from 1 to ${MAX_ALERT_LEVEL}.`),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const alertMessage = interaction.fields.getTextInputValue(ALERT_MESSAGE_INPUT_ID).trim();
      await updateWarnSettings(guildId, { alertLevel, alertMessage });
      await showLogView(interaction, guildId);
      return;
    }

    if (verb === 'main') {
      await showSection(interaction, warningsSection, guildId);
      return;
    }

    if (verb === 'remove') {
      await removeLastStep(guildId);
      await showSection(interaction, warningsSection, guildId);
      return;
    }

    if (verb === 'edit' && interaction.isButton()) {
      const step = (await getWarningSteps(guildId)).find((s) => s.level === level);
      if (!step) return;
      const input = new TextInputBuilder()
        .setCustomId(TIME_INPUT_ID)
        .setLabel('Timeout length (e.g. 30m, 2h, 1d)')
        .setStyle(TextInputStyle.Short)
        .setValue(formatDuration(step.timeoutMinutes))
        .setRequired(true)
        .setMaxLength(20);
      const modal = new ModalBuilder()
        .setCustomId(`config:warnings:time:${level}`)
        .setTitle(`Warning ${level} timeout`)
        .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
      return;
    }

    if (verb === 'time' && interaction.isModalSubmit()) {
      const minutes = parseDuration(interaction.fields.getTextInputValue(TIME_INPUT_ID));
      if (minutes === null || minutes < 1 || minutes > MAX_TIMEOUT_MINUTES) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              'That is not a valid time. Use something like `30m`, `2h`, `1d` or `1h30m`, ' +
                'between 1 minute and 28 days.',
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await setStepTimeout(guildId, level, minutes);
      await showSection(interaction, warningsSection, guildId);
    }
  },
};
