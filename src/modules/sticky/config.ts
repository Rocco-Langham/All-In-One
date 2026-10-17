import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputStyle,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { asMessage, sectionView } from '../../core/configPanel.js';
import { parseDuration } from '../../core/duration.js';
import { errorEmbed } from '../../core/embeds.js';
import { themeColor } from '../../core/theme.js';
import { logger } from '../../core/logger.js';
import type { ConfigSection } from '../../core/types.js';
import { postSticky, removeSticky } from './poster.js';
import { countStickies, getSticky, listStickies, MAX_STICKIES, saveSticky } from './store.js';

// Custom ids handled here (after config:sticky:):
//   new           "New Sticky" button, opens the popup
//   create        the popup being submitted
//   delete:<id>   "Delete" button next to a sticky
const FIELD = { channel: 'channel', message: 'message', expiry: 'expiry', image: 'image' };
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_EXPIRY_MINUTES = 365 * 24 * 60;
const PREVIEW_LENGTH = 120;

function preview(content: string | null) {
  if (!content) return '*No text*';
  const oneLine = content.replaceAll('\n', ' ');
  return oneLine.length > PREVIEW_LENGTH ? `${oneLine.slice(0, PREVIEW_LENGTH)}…` : oneLine;
}

function newStickyModal() {
  return new ModalBuilder()
    .setCustomId('config:sticky:create')
    .setTitle('New Sticky')
    .addLabelComponents(
      (l) =>
        l
          .setLabel('Channel')
          .setDescription('Where the sticky stays at the bottom')
          .setChannelSelectMenuComponent((c) =>
            c
              .setCustomId(FIELD.channel)
              .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
              .setMaxValues(1),
          ),
      (l) =>
        l
          .setLabel('Message')
          .setDescription('The text of the sticky (optional if you add an image)')
          .setTextInputComponent((t) =>
            t
              .setCustomId(FIELD.message)
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
              .setMaxLength(2000),
          ),
      (l) =>
        l
          .setLabel('Auto-delete after')
          .setDescription('e.g. 30m, 12h or 7d. Leave empty to keep it forever.')
          .setTextInputComponent((t) =>
            t
              .setCustomId(FIELD.expiry)
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setMaxLength(20),
          ),
      (l) =>
        l
          .setLabel('Image')
          .setDescription('Optional, up to 8 MB')
          .setFileUploadComponent((f) =>
            f.setCustomId(FIELD.image).setRequired(false).setMaxValues(1),
          ),
    );
}

export const stickySection: ConfigSection = {
  id: 'sticky',
  label: 'Sticky messages',
  description: 'Messages that stay at the bottom.',
  emoji: '📌',

  async render(guildId) {
    const stickies = await listStickies(guildId);

    const container = new ContainerBuilder()
      .setAccentColor(themeColor(guildId))
      .addTextDisplayComponents((t) =>
        t.setContent(
          '## 📌 Sticky messages\n' +
            'A sticky stays at the bottom of its channel: when people chat, I repost it ' +
            'so it is always the last message.',
        ),
      );

    if (stickies.length === 0) {
      container.addTextDisplayComponents((t) => t.setContent('*No sticky messages yet.*'));
    }

    for (const s of stickies) {
      const extras = [
        s.imageName ? '🖼️ Image' : null,
        s.expiresAt
          ? `⏳ Deletes <t:${Math.floor(s.expiresAt.getTime() / 1000)}:R>`
          : '⏳ Never deletes',
      ].filter(Boolean);
      container
        .addSeparatorComponents((sep) => sep)
        .addSectionComponents((section) =>
          section
            .addTextDisplayComponents((t) =>
              t.setContent(`**<#${s.channelId}>**\n> ${preview(s.content)}\n${extras.join(' · ')}`),
            )
            .setButtonAccessory((b) =>
              b
                .setCustomId(`config:sticky:delete:${s.id}`)
                .setLabel('Delete')
                .setEmoji({ name: '🗑️' })
                .setStyle(ButtonStyle.Danger),
            ),
        );
    }

    container.addActionRowComponents(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('config:sticky:new')
          .setLabel('New Sticky')
          .setEmoji('➕')
          .setStyle(ButtonStyle.Success)
          .setDisabled(stickies.length >= MAX_STICKIES),
      ),
    );
    if (stickies.length >= MAX_STICKIES) {
      container.addTextDisplayComponents((t) =>
        t.setContent(`-# You can have up to ${MAX_STICKIES} stickies. Delete one to add another.`),
      );
    }

    return { components: [container] };
  },

  async handle(interaction, action, guildId) {
    const [verb, idText = ''] = action.split(':');

    if (verb === 'new' && interaction.isButton()) {
      await interaction.showModal(newStickyModal());
      return;
    }

    if (verb === 'delete' && interaction.isButton()) {
      const sticky = await getSticky(guildId, Number(idText));
      if (sticky) await removeSticky(interaction.client, sticky);
      await interaction.update(asMessage(await sectionView(stickySection, guildId)));
      return;
    }

    if (verb !== 'create' || !interaction.isModalSubmit() || !interaction.isFromMessage()) return;

    // Downloading the image and posting can take a few seconds.
    await interaction.deferUpdate();
    const fail = (message: string) =>
      interaction.followUp({ embeds: [errorEmbed(message)], flags: MessageFlags.Ephemeral });

    const channel = interaction.fields.getSelectedChannels(FIELD.channel, true).first();
    const content = interaction.fields.getTextInputValue(FIELD.message).trim() || null;
    const expiryText = interaction.fields.getTextInputValue(FIELD.expiry).trim();
    const upload = interaction.fields.getUploadedFiles(FIELD.image)?.first() ?? null;

    if (!channel) return fail('Pick a channel for the sticky.');
    if (!content && !upload) return fail('Add a message, an image, or both.');

    let expiresAt: Date | null = null;
    if (expiryText) {
      const minutes = parseDuration(expiryText);
      if (minutes === null || minutes < 1 || minutes > MAX_EXPIRY_MINUTES) {
        return fail(
          'Auto-delete must be a time like `30m`, `12h` or `7d`, up to 365 days. ' +
            'Leave it empty to keep the sticky forever.',
        );
      }
      expiresAt = new Date(Date.now() + minutes * 60_000);
    }

    let image: { name: string; data: Buffer } | null = null;
    if (upload) {
      if (!upload.contentType?.startsWith('image/')) return fail('The file must be an image.');
      if (upload.size > MAX_IMAGE_BYTES) return fail('The image must be 8 MB or smaller.');
      try {
        const res = await fetch(upload.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        image = { name: upload.name, data: Buffer.from(await res.arrayBuffer()) };
      } catch (err) {
        logger.warn('Downloading a sticky image failed', err);
        return fail("I couldn't read that image. Please try uploading it again.");
      }
    }

    const existing = await listStickies(guildId);
    const replacing = existing.some((s) => s.channelId === channel.id);
    if (!replacing && (await countStickies(guildId)) >= MAX_STICKIES) {
      return fail(`You can have up to ${MAX_STICKIES} stickies. Delete one first.`);
    }

    // When replacing, the saved row keeps the old copy's id, so posting removes the old copy.
    const sticky = await saveSticky({ guildId, channelId: channel.id, content, image, expiresAt });
    const posted = await postSticky(interaction.client, sticky);

    await interaction.editReply(asMessage(await sectionView(stickySection, guildId)));
    if (!posted) {
      await fail(
        `I saved the sticky but couldn't post it in ${channel}. ` +
          'Check that I can view the channel, send messages and attach files there.',
      );
    } else if (replacing) {
      await interaction.followUp({
        content: `Replaced the sticky in ${channel}.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
