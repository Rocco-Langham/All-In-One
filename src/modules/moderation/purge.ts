import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type Message,
} from 'discord.js';
import { errorEmbed, successEmbed } from '../../core/embeds.js';
import type { Command } from '../../core/types.js';

/** Discord deletes at most 100 messages at once. */
const MAX_AMOUNT = 100;
/** When filtering by member, how far back to look for their messages. */
const MAX_SCANNED = 500;
/** Discord can't bulk-delete messages older than 14 days. */
const BULK_DELETE_LIMIT_MS = 14 * 24 * 60 * 60_000;

export const purgeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete recent messages in this channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((o) =>
      o
        .setName('amount')
        .setDescription(`How many messages to delete (1-${MAX_AMOUNT})`)
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(MAX_AMOUNT),
    )
    .addUserOption((o) => o.setName('user').setDescription("Only delete this member's messages")),

  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    const channel = interaction.channel;
    if (!channel || !('bulkDelete' in channel)) {
      await interaction.reply({
        embeds: [errorEmbed("Messages can't be purged in this channel.")],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const me = interaction.guild.members.me;
    const needed = [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory];
    if (!me || !channel.permissionsFor(me).has(needed)) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            'I need the **Manage Messages** and **Read Message History** permissions here.',
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const amount = interaction.options.getInteger('amount', true);
    const user = interaction.options.getUser('user');
    // Finding and deleting messages can take a few seconds.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const cutoff = Date.now() - BULK_DELETE_LIMIT_MS;
    const toDelete: Message[] = [];
    let skippedOld = false;
    let before: string | undefined;
    for (let scanned = 0; scanned < MAX_SCANNED && toDelete.length < amount;) {
      const batch = await channel.messages.fetch({ limit: 100, before });
      if (batch.size === 0) break;
      scanned += batch.size;
      before = batch.last()?.id;

      for (const message of batch.values()) {
        if (toDelete.length >= amount) break;
        if (message.createdTimestamp < cutoff) {
          skippedOld = true;
          break;
        }
        // Pinned messages are kept.
        if (message.pinned || (user && message.author.id !== user.id)) continue;
        toDelete.push(message);
      }
      // Everything further back is too old to delete.
      if (skippedOld) break;
    }

    const deleted = toDelete.length > 0 ? (await channel.bulkDelete(toDelete, true)).size : 0;

    const notes = [
      skippedOld
        ? "Messages older than 14 days were left alone, as Discord won't bulk-delete them."
        : null,
      deleted < amount && !skippedOld ? 'There were no more matching messages to delete.' : null,
    ].filter(Boolean);
    await interaction.editReply({
      embeds: [
        deleted === 0
          ? errorEmbed(`No messages were deleted.${notes.length ? `\n${notes.join('\n')}` : ''}`)
          : successEmbed(
              interaction.guildId,
              `Deleted **${deleted}** message${deleted === 1 ? '' : 's'}` +
                `${user ? ` from ${user}` : ''}.` +
                (notes.length ? `\n-# ${notes.join('\n-# ')}` : ''),
            ),
      ],
    });
  },
};
