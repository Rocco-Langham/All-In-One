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
import { logWarningEvent, sendAlertIfReached } from '../log.js';
import { canManageWarnings } from '../permissions.js';
import { getWarningSteps, stepForCount } from '../steps.js';
import { addWarning, countWarnings } from '../warnings.js';

export const warnCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member and give them the timeout for that warning.')
    // Who can warn is decided by the roles in Warning config, so the command is visible to all.
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName('user').setDescription('Who to warn').setRequired(true))
    .addStringOption((o) =>
      o.setName('reason').setDescription('Why they are being warned').setMaxLength(400),
    ),

  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    const fail = (message: string) =>
      interaction.reply({ embeds: [errorEmbed(message)], flags: MessageFlags.Ephemeral });

    const guildId = interaction.guildId;
    const moderator = interaction.member;
    if (!(await canManageWarnings(moderator))) {
      return fail("You don't have a role that is allowed to give warnings.");
    }

    const target = interaction.options.getMember('user');
    if (!target) return fail('That user is not in this server.');
    if (target.id === moderator.id) return fail("You can't warn yourself.");
    if (target.user.bot) return fail("Bots can't be warned.");
    if (target.id === interaction.guild.ownerId) return fail("The server owner can't be warned.");
    if (
      moderator.id !== interaction.guild.ownerId &&
      target.roles.highest.position >= moderator.roles.highest.position
    ) {
      return fail(`You can't warn ${target}: their highest role is the same as or above yours.`);
    }
    if (!target.moderatable) {
      return fail(
        `I can't time out ${target}. They may be an admin, or their role is above mine. ` +
          'Move my role higher in Server Settings → Roles.',
      );
    }

    const count = (await countWarnings(guildId, target.id)) + 1;
    const step = stepForCount(await getWarningSteps(guildId), count);
    if (!step) return fail('No warning punishments are set up. Use /config to add one.');

    const reason = interaction.options.getString('reason');
    const length = formatDuration(step.timeoutMinutes);
    await target.timeout(
      step.timeoutMinutes * 60_000,
      `Warning ${count}, given by ${moderator.user.tag}${reason ? `: ${reason}` : ''}`,
    );
    await addWarning(guildId, target.id, moderator.id, {
      reason,
      level: count,
      timeoutMinutes: step.timeoutMinutes,
    });

    const embed = new EmbedBuilder()
      .setColor(themeColor(guildId))
      .setDescription(
        `⚠️ ${target} has been warned by ${moderator}.\n` +
          `This is **warning ${count}**, so they are timed out for **${length}**.` +
          (reason ? `\n**Reason:** ${reason}` : ''),
      );
    await interaction.reply({ embeds: [embed] });

    const logEntry = new EmbedBuilder()
      .setColor(themeColor(guildId))
      .setTitle('⚠️ Warning given')
      .addFields(
        { name: 'Member', value: `${target} (${target.user.tag})`, inline: true },
        { name: 'Warning', value: `Warning ${count}`, inline: true },
        { name: 'Punishment', value: `${length} timeout`, inline: true },
        { name: 'Reason', value: reason ?? '*No reason given*' },
        { name: 'Dispatched by', value: `${moderator}`, inline: true },
      )
      .setTimestamp();
    await logWarningEvent(interaction.guild, logEntry);
    await sendAlertIfReached(interaction.guild, {
      userId: target.id,
      moderatorId: moderator.id,
      level: count,
      reason,
    });
  },
};
