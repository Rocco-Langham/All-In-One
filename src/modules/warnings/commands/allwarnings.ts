import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { formatDuration } from '../../../core/duration.js';
import { errorEmbed } from '../../../core/embeds.js';
import { themeColor } from '../../../core/theme.js';
import type { Command, ComponentHandler } from '../../../core/types.js';
import { countWarnings, listWarnings } from '../warnings.js';

const PAGE_SIZE = 8;
/** Long reasons are shortened in the list so a page stays within Discord's size limit. */
const MAX_REASON_SHOWN = 200;

/** The details each warning can show; the buttons at the top switch them on and off. */
const DETAILS = {
  p: { label: 'Punishment', emoji: '⏱️' },
  r: { label: 'Reason', emoji: '📝' },
  d: { label: 'Dispatched by', emoji: '🛡️' },
} as const;
type Detail = keyof typeof DETAILS;
const ALL_DETAILS = Object.keys(DETAILS) as Detail[];

export interface ListState {
  page: number;
  shown: Set<Detail>;
  /** Set when viewing one player's warnings instead of the whole server's. */
  userId?: string;
}

export function initialState(userId?: string): ListState {
  return { page: 0, shown: new Set(ALL_DETAILS), userId };
}

// The list's state rides along in every button's custom id, so nothing needs storing
// between clicks: allwarn:<action>:<page>:<shown letters or ->:<player id or ->
// <action> is "page", "show-<letter>" (switch a detail on or off),
// "view-<warning #>" (open that warning's player; the # just keeps ids unique) or "all".
function encode(action: string, state: ListState) {
  const shown = [...state.shown].join('') || '-';
  return `allwarn:${action}:${state.page}:${shown}:${state.userId ?? '-'}`;
}

function decode(customId: string): { action: string; state: ListState } | null {
  const [, action, page, shown, userId] = customId.split(':');
  if (!action || !page || !shown) return null;
  const letters = shown.split('').filter((c): c is Detail => c in DETAILS);
  return {
    action,
    state: {
      page: Number(page),
      shown: new Set(letters),
      userId: userId && userId !== '-' ? userId : undefined,
    },
  };
}

function row(...buttons: ButtonBuilder[]) {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(buttons);
}

/** The /allwarnings list, or one player's warnings when `state.userId` is set. */
export async function renderList(guildId: string, state: ListState) {
  const { userId } = state;
  const total = await countWarnings(guildId, userId);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(state.page, 0), pageCount - 1);
  const warnings = await listWarnings(guildId, page, PAGE_SIZE, userId);
  const current: ListState = { ...state, page };

  const topRows = [
    row(
      ...ALL_DETAILS.map((key) => {
        const on = state.shown.has(key);
        return new ButtonBuilder()
          .setCustomId(encode(`show-${key}`, current))
          .setLabel(DETAILS[key].label)
          .setEmoji(on ? '✅' : '❌')
          .setStyle(on ? ButtonStyle.Success : ButtonStyle.Secondary);
      }),
      new ButtonBuilder()
        .setCustomId(encode('page', { ...current, page: page - 1 }))
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId(encode('page', { ...current, page: page + 1 }))
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= pageCount - 1),
    ),
  ];
  if (userId) {
    topRows.push(
      row(
        new ButtonBuilder()
          .setCustomId(encode('all', current))
          .setLabel('All warnings')
          .setEmoji('⬅️')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
  }

  const title = userId ? `## ⚠️ Warnings for <@${userId}>` : '## ⚠️ All warnings';
  const container = new ContainerBuilder()
    .setAccentColor(themeColor(guildId))
    .addTextDisplayComponents((t) =>
      t.setContent(
        `${title}\nPage ${page + 1} of ${pageCount} · ${total} warning${total === 1 ? '' : 's'}`,
      ),
    );

  if (total === 0) {
    container.addTextDisplayComponents((t) =>
      t.setContent(userId ? 'This player has no warnings.' : 'No warnings have been given yet.'),
    );
  }

  for (const w of warnings) {
    const when = `<t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`;
    const lines = [
      `**${w.level !== null ? `Warning ${w.level}` : 'Warning'}**` +
        (userId ? '' : ` · <@${w.userId}>`) +
        ` · ${when}`,
    ];
    if (state.shown.has('p')) {
      const punishment =
        w.timeoutMinutes !== null ? `${formatDuration(w.timeoutMinutes)} timeout` : 'Unknown';
      lines.push(`${DETAILS.p.emoji} **Punishment:** ${punishment}`);
    }
    if (state.shown.has('r')) {
      const reason = !w.reason
        ? '*No reason given*'
        : w.reason.length > MAX_REASON_SHOWN
          ? `${w.reason.slice(0, MAX_REASON_SHOWN)}…`
          : w.reason;
      lines.push(`${DETAILS.r.emoji} **Reason:** ${reason}`);
    }
    if (state.shown.has('d')) {
      lines.push(`${DETAILS.d.emoji} **Dispatched by:** <@${w.moderatorId}>`);
    }

    container.addSeparatorComponents((s) => s);
    if (userId) {
      container.addTextDisplayComponents((t) => t.setContent(lines.join('\n')));
    } else {
      // In the full list, each warning gets a button to open that player's warnings.
      container.addSectionComponents((section) =>
        section
          .addTextDisplayComponents((t) => t.setContent(lines.join('\n')))
          .setButtonAccessory((b) =>
            b
              .setCustomId(encode(`view-${w.id}`, { ...current, page: 0, userId: w.userId }))
              .setLabel('Player warnings')
              .setEmoji({ name: '👤' })
              .setStyle(ButtonStyle.Secondary),
          ),
      );
    }
  }

  return {
    components: [...topRows, container],
    flags: MessageFlags.IsComponentsV2,
    // Mentions here are for display only; never ping anyone from the list.
    allowedMentions: { parse: [] },
  } as const;
}

export const allWarningsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('allwarnings')
    .setDescription('List every warning given in this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (!interaction.inGuild()) return;
    const message = await renderList(interaction.guildId, initialState());
    await interaction.reply({ ...message, flags: message.flags | MessageFlags.Ephemeral });
  },
};

export const allWarningsPager: ComponentHandler = {
  prefix: 'allwarn:',
  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.isButton()) return;
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({
        embeds: [errorEmbed('You need the **Timeout Members** permission to view warnings.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const decoded = decode(interaction.customId);
    if (!decoded) return;
    const { action, state } = decoded;

    if (action.startsWith('show-')) {
      const key = action.slice('show-'.length) as Detail;
      if (key in DETAILS) {
        if (state.shown.has(key)) state.shown.delete(key);
        else state.shown.add(key);
      }
    } else if (action === 'all') {
      state.userId = undefined;
      state.page = 0;
    }

    await interaction.update(await renderList(interaction.guildId, state));
  },
};
