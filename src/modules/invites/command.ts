import { EmbedBuilder, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { themeColor } from '../../core/theme.js';
import type { Command } from '../../core/types.js';
import { leaderboard, recentInvites, statsFor } from './store.js';
import { canTrack } from './tracker.js';

const LEADERBOARD_SIZE = 15;
const RECENT_SIZE = 5;

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export const inviteTrackCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('invitetrack')
    .setDescription('See how many people each member has invited to the server.')
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) =>
      o.setName('user').setDescription("Show one member's invites instead of the leaderboard"),
    ),

  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    const guildId = interaction.guildId;
    const user = interaction.options.getUser('user');
    const embed = new EmbedBuilder().setColor(themeColor(guildId));

    if (user) {
      const stats = await statsFor(guildId, user.id);
      const recent = await recentInvites(guildId, user.id, RECENT_SIZE);
      embed
        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
        .setTitle('📨 Invites')
        .setDescription(
          `${user} has **${plural(stats.total, 'invite')}**.\n\n` +
            `✅ **Joined:** ${stats.joined}\n` +
            `❌ **Left:** ${stats.left}`,
        );
      if (recent.length > 0) {
        embed.addFields({
          name: 'Recently invited',
          value: recent.map((r) => `<@${r.memberId}>${r.left ? ' (left)' : ''}`).join('\n'),
        });
      }
    } else {
      const top = (await leaderboard(guildId)).slice(0, LEADERBOARD_SIZE);
      const medals = ['🥇', '🥈', '🥉'];
      embed
        .setTitle('📨 Invite leaderboard')
        .setDescription(
          top.length === 0
            ? 'Nobody has invited anyone yet.'
            : top
                .map(
                  (s, i) =>
                    `${medals[i] ?? `**${i + 1}.**`} <@${s.inviterId}>: ` +
                    `**${plural(s.total, 'invite')}** (${s.joined} joined, ${s.left} left)`,
                )
                .join('\n'),
        );
    }

    embed.setFooter({
      text: canTrack(interaction.guild)
        ? 'Counts people who joined since the bot started tracking. Members who left are taken off.'
        : '⚠️ I need the Manage Server permission to see which invite people use.',
    });
    // Show names without pinging anyone.
    await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};
