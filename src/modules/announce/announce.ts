import {
  ChannelType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type Guild,
  type GuildMember,
  type MessageCreateOptions,
} from 'discord.js';
import { errorEmbed, successEmbed } from '../../core/embeds.js';
import { logger } from '../../core/logger.js';
import { hex, parseHex, themeColor, THEMES } from '../../core/theme.js';
import type { Command } from '../../core/types.js';

const MAX_CHOICES = 25;

/** What /announce should ping: everyone, here, or a role id. */
type Mention = { kind: 'everyone' } | { kind: 'here' } | { kind: 'role'; id: string };

function parseMention(value: string | null, guild: Guild): Mention | null | 'invalid' {
  if (!value) return null;
  if (value === 'everyone') return { kind: 'everyone' };
  if (value === 'here') return { kind: 'here' };
  return guild.roles.cache.has(value) ? { kind: 'role', id: value } : 'invalid';
}

/** Discord only lets you ping @everyone, @here or locked roles with Mention Everyone. */
function canMention(member: GuildMember, mention: Mention) {
  if (member.permissions.has(PermissionFlagsBits.MentionEveryone)) return true;
  if (mention.kind !== 'role') return false;
  return member.guild.roles.cache.get(mention.id)?.mentionable ?? false;
}

/** A theme name like "Red" or a hex code like "#FF8800". */
function parseColour(value: string): number | null {
  const theme = THEMES.find((t) => t.id === value.toLowerCase() || t.label === value);
  return theme ? theme.color : parseHex(value);
}

/** Command boxes can't hold line breaks, so "\n" typed in the message starts a new line. */
function withLineBreaks(text: string) {
  return text.replaceAll('\\n', '\n');
}

export const announceCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Post an announcement.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) =>
      o
        .setName('message')
        .setDescription('The announcement. Type \\n for a new line. Supports **bold**.')
        .setRequired(true)
        .setMaxLength(4000),
    )
    .addStringOption((o) =>
      o.setName('heading').setDescription('Optional title at the top').setMaxLength(256),
    )
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Where to post it (leave empty for this channel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
    )
    .addStringOption((o) =>
      o
        .setName('mention')
        .setDescription('Who to ping. The ping is hidden in the announcement.')
        .setAutocomplete(true),
    )
    .addStringOption((o) =>
      o
        .setName('colour')
        .setDescription('Side bar colour: pick one or type a hex code like #FF8800')
        .setAutocomplete(true)
        .setMaxLength(20),
    ),

  async autocomplete(interaction) {
    if (!interaction.inCachedGuild()) return;
    const focused = interaction.options.getFocused(true);
    const query = focused.value.toLowerCase();

    if (focused.name === 'colour') {
      const choices: { name: string; value: string }[] = THEMES.filter((t) =>
        t.label.toLowerCase().includes(query),
      ).map((t) => ({ name: `${t.emoji} ${t.label} (${hex(t.color)})`, value: t.id }));
      // Let a typed hex code through as its own choice.
      const typed = parseHex(focused.value);
      if (typed !== null) choices.unshift({ name: `🎨 ${hex(typed)}`, value: hex(typed) });
      await interaction.respond(choices.slice(0, MAX_CHOICES));
      return;
    }

    const roles = interaction.guild.roles.cache
      .filter((r) => r.id !== interaction.guild.id && !r.managed)
      .filter((r) => r.name.toLowerCase().includes(query))
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ name: `@${r.name}`, value: r.id }));
    const special = [
      { name: '@everyone', value: 'everyone' },
      { name: '@here', value: 'here' },
    ].filter((c) => c.name.includes(query));
    await interaction.respond([...special, ...roles].slice(0, MAX_CHOICES));
  },

  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    const fail = (message: string) =>
      interaction.reply({ embeds: [errorEmbed(message)], flags: MessageFlags.Ephemeral });

    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    if (!channel?.isSendable()) return fail("I can't post in that channel.");

    const mention = parseMention(interaction.options.getString('mention'), interaction.guild);
    if (mention === 'invalid') return fail('Pick who to mention from the list.');
    if (mention && !canMention(interaction.member, mention)) {
      return fail("You don't have permission to ping that. You need **Mention Everyone**.");
    }

    const colourText = interaction.options.getString('colour');
    const colour = colourText ? parseColour(colourText) : themeColor(interaction.guildId);
    if (colour === null) {
      return fail("That colour isn't valid. Pick one from the list or type a code like `#FF8800`.");
    }

    const message = withLineBreaks(interaction.options.getString('message', true).trim());
    const heading = interaction.options.getString('heading')?.trim();

    const embed = new EmbedBuilder().setColor(colour).setDescription(message).setTimestamp();
    if (heading) embed.setTitle(withLineBreaks(heading));

    const payload: MessageCreateOptions = { embeds: [embed], allowedMentions: { parse: [] } };
    if (mention?.kind === 'role') {
      payload.content = `<@&${mention.id}>`;
      payload.allowedMentions = { roles: [mention.id] };
    } else if (mention) {
      payload.content = `@${mention.kind}`;
      payload.allowedMentions = { parse: ['everyone'] };
    }

    try {
      const sent = await channel.send(payload);
      // Hidden mention: the ping goes out when the message is sent, then the visible
      // @mention is removed so only the announcement shows.
      if (payload.content) await sent.edit({ content: '' });
    } catch (err) {
      logger.warn(`Announcement in ${channel.id} failed`, err);
      return fail(
        `I couldn't post in ${channel}. Check that I can send messages and embed links there` +
          (mention ? ', and mention everyone if you used a ping.' : '.'),
      );
    }

    await interaction.reply({
      embeds: [successEmbed(interaction.guildId, `Announcement posted in ${channel}.`)],
      flags: MessageFlags.Ephemeral,
    });
  },
};
