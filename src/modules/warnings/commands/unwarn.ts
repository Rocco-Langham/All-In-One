import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { formatDuration } from '../../../core/duration.js';
import { errorEmbed } from '../../../core/embeds.js';
import { themeColor } from '../../../core/theme.js';
import type { Command } from '../../../core/types.js';
import { logWarningEvent } from '../log.js';
import { canManageWarnings } from '../permissions.js';
import {
  countWarnings,
  deleteWarning,
  findWarning,
  isLatestWarning,
  listWarnings,
} from '../warnings.js';

/** Discord shows at most 25 suggestions. */
const MAX_CHOICES = 25;

export const unwarnCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription("Remove a member's warning. Removes their latest one unless you pick one.")
    // Same access as /warn: decided by the roles in Warning config.
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) =>
      o.setName('user').setDescription('Whose warning to remove').setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName('warning')
        .setDescription('Which warning to remove (leave empty for their latest)')
        .setAutocomplete(true),
    ),

  // Lists the chosen member's warnings to pick from; the hidden value is the warning's id.
  async autocomplete(interaction) {
    if (!interaction.inCachedGuild()) return;
    const userId = interaction.options.get('user')?.value;
    // Only people who may remove warnings get to see them listed.
    if (typeof userId !== 'string' || !(await canManageWarnings(interaction.member))) {
      await interaction.respond([]);
      return;
    }
    const warnings = await listWarnings(interaction.guildId, 0, MAX_CHOICES, userId);
    await interaction.respond(
      warnings.map((w) => {
        const parts = [
          w.level !== null ? `Warning ${w.level}` : 'Warning',
          w.timeoutMinutes !== null ? `${formatDuration(w.timeoutMinutes)} timeout` : null,
          w.reason,
          w.createdAt.toISOString().slice(0, 10),
        ].filter(Boolean);
        // Choice names can be at most 100 characters.
        const name = parts.join(' · ');
        return { name: name.length > 100 ? `${name.slice(0, 99)}…` : name, value: w.id };
      }),
    );
  },

  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    const fail = (message: string) =>
      interaction.reply({ embeds: [errorEmbed(message)], flags: MessageFlags.Ephemeral });

    if (!(await canManageWarnings(interaction.member))) {
      return fail("You don't have a role that is allowed to remove warnings.");
    }

    const guildId = interaction.guildId;
    const user = interaction.options.getUser('user', true);
    const id = interaction.options.getInteger('warning') ?? undefined;

    const warning = await findWarning(guildId, user.id, id);
    if (!warning) {
      return fail(
        id
          ? `That warning wasn't found for ${user}. Pick one from the list when typing the command.`
          : `${user} doesn't have any warnings.`,
      );
    }

    // Lift the timeout only when removing the warning that caused it: their latest one.
    const wasLatest = await isLatestWarning(guildId, user.id, warning.id);
    await deleteWarning(warning.id);
    const remaining = await countWarnings(guildId, user.id);

    let timeoutNote = '';
    const member = interaction.options.getMember('user');
    if (wasLatest && member?.isCommunicationDisabled()) {
      if (member.moderatable) {
        await member.timeout(null, `Warning removed by ${interaction.user.tag}`);
        timeoutNote = '\nTheir timeout has been lifted.';
      } else {
        timeoutNote = "\nI couldn't lift their timeout because their role is above mine.";
      }
    }

    const label = warning.level !== null ? `Warning ${warning.level}` : 'a warning';
    const embed = new EmbedBuilder()
      .setColor(themeColor(guildId))
      .setDescription(
        `✅ Removed **${label}** from ${user}.\n` +
          `They now have **${remaining}** warning${remaining === 1 ? '' : 's'}.` +
          timeoutNote,
      );
    await interaction.reply({ embeds: [embed] });

    const logEntry = new EmbedBuilder()
      .setColor(themeColor(guildId))
      .setTitle('✅ Warning removed')
      .addFields(
        { name: 'Member', value: `${user} (${user.tag})`, inline: true },
        { name: 'Removed', value: label, inline: true },
        { name: 'Warnings left', value: String(remaining), inline: true },
        { name: 'Original reason', value: warning.reason ?? '*No reason given*' },
        { name: 'Removed by', value: `${interaction.user}`, inline: true },
      )
      .setTimestamp();
    await logWarningEvent(interaction.guild, logEntry);
  },
};
