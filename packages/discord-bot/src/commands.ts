import { SlashCommandBuilder, ChatInputCommandInteraction, CacheType } from 'discord.js';
import { JobManager, JobScheduler, UserManager } from '@connpass-discord-bot/job';
import { ConnpassClient } from '@connpass-discord-bot/api-client';

export const commandData = new SlashCommandBuilder()
  .setName('connpass')
  .setDescription('Manage Connpass watch jobs for this channel')
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Add or update a watch for this channel')
      .addIntegerOption((o) => o.setName('interval_sec').setDescription('Interval seconds (default 1800)').setMinValue(60))
      .addStringOption((o) => o.setName('keywords_and').setDescription('Keywords (AND). Comma or space separated'))
      .addStringOption((o) => o.setName('keywords_or').setDescription('Keywords (OR). Comma or space separated'))
      .addIntegerOption((o) => o.setName('range_days').setDescription('Days from now to search (default 14)').setMinValue(1).setMaxValue(90))
      .addStringOption((o) =>
        o
          .setName('location')
          .setDescription('Filter by prefecture (autocomplete; comma/space separated)')
          .setAutocomplete(true)
      )
      .addStringOption((o) => o.setName('hashtag').setDescription('Filter by hashtag (e.g. typescript, no #)'))
      .addStringOption((o) => o.setName('owner_nickname').setDescription('Filter by owner nickname'))
  )
  .addSubcommand((sub) =>
    sub
      .setName('sort')
      .setDescription('Change sort type/order for search results')
      .addStringOption((o) =>
        o
          .setName('order')
          .setDescription('Select sort: updated_desc | started_asc | started_desc')
          .setRequired(true)
          .addChoices(
            { name: '更新日時の降順 (updated_desc)', value: 'updated_desc' },
            { name: '開催日時の昇順 (started_asc)', value: 'started_asc' },
            { name: '開催日時の降順 (started_desc)', value: 'started_desc' },
          ),
      )
  )
  .addSubcommand((sub) => sub.setName('status').setDescription('Show current watch settings for this channel'))
  .addSubcommand((sub) => sub.setName('remove').setDescription('Remove watch for this channel'))
  .addSubcommand((sub) => sub.setName('run').setDescription('Run watch once immediately'))
  .addSubcommandGroup((group) =>
    group
      .setName('user')
      .setDescription('Manage user settings')
      .addSubcommand((sub) =>
        sub
          .setName('register')
          .setDescription('Register your connpass nickname')
          .addStringOption((o) => o.setName('nickname').setDescription('Your connpass nickname').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName('show')
          .setDescription('Show your registered connpass nickname')
      )
      .addSubcommand((sub) =>
        sub
          .setName('unregister')
          .setDescription('Unregister your connpass nickname')
      )
  )
  .addSubcommand((sub) => sub.setName('today').setDescription('Show your events for today'))
  .toJSON();

export async function handleCommand(
  interaction: ChatInputCommandInteraction<CacheType>,
  manager: JobManager,
  scheduler: JobScheduler,
  userManager: UserManager,
  api: ConnpassClient,
) {
  if (!interaction.channelId) {
    await interaction.reply({ content: 'Channel is not available.', ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand(true);
  const group = interaction.options.getSubcommandGroup();
  const jobId = interaction.channelId;

  if (group === 'user') {
    if (sub === 'register') {
      const nickname = interaction.options.getString('nickname', true);
      await userManager.register(interaction.user.id, nickname);
      await interaction.reply({ content: `Registered your connpass nickname as: ${nickname}`, ephemeral: true });
      return;
    }
    if (sub === 'show') {
      const user = await userManager.find(interaction.user.id);
      if (!user) {
        await interaction.reply({ content: 'Your connpass nickname is not registered.', ephemeral: true });
        return;
      }
      // Try to enrich with numeric user ID via API
      try {
        const users = await api.searchUsers({ nickname: user.connpassNickname, count: 1 });
        const u = users.users[0];
        if (u) {
          const link = u.url ?? `https://connpass.com/user/${encodeURIComponent(u.nickname)}/`;
          await interaction.reply({ content: `Your connpass: ${u.nickname} (id: ${u.id})\n${link}`, ephemeral: true });
        } else {
          await interaction.reply({ content: `Your connpass nickname: ${user.connpassNickname}`, ephemeral: true });
        }
      } catch {
        await interaction.reply({ content: `Your connpass nickname: ${user.connpassNickname}`, ephemeral: true });
      }
      return;
    }
    if (sub === 'unregister') {
      const user = await userManager.find(interaction.user.id);
      if (!user) {
        await interaction.reply({ content: 'Nothing to unregister. You are not registered.', ephemeral: true });
      } else {
        await userManager.unregister(interaction.user.id);
        await interaction.reply({ content: 'Unregistered your connpass nickname.', ephemeral: true });
      }
      return;
    }
    return;
  }

  if (sub === 'set') {
    const intervalSec = interaction.options.getInteger('interval_sec') ?? 1800;
    const keywordsAndRaw = interaction.options.getString('keywords_and') ?? '';
    const keywordsOrRaw = interaction.options.getString('keywords_or') ?? '';
    const rangeDays = interaction.options.getInteger('range_days') ?? 14;
    const locationRaw = interaction.options.getString('location') ?? '';
    const prefectures = locationRaw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const hashTagOpt = interaction.options.getString('hashtag') ?? undefined;
    const hashTag = hashTagOpt ? hashTagOpt.replace(/^#/, '').trim() || undefined : undefined;
    const ownerNickname = interaction.options.getString('owner_nickname') ?? undefined;

    const tokensAnd = keywordsAndRaw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const tokensOr = keywordsOrRaw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const config = {
      id: jobId,
      channelId: jobId,
      intervalSec,
      keyword: tokensAnd.length ? tokensAnd : undefined,
      keywordOr: tokensOr.length ? tokensOr : undefined,
      rangeDays,
      prefecture: prefectures.length > 0 ? prefectures : undefined,
      hashTag,
      ownerNickname,
    } as const;

    await manager.upsert(config);
    await scheduler.restart(jobId);
    await interaction.reply({
      content: `OK: watching this channel.\n- keywords(and): ${tokensAnd.join(', ') || '(none)'}\n- keywords(or): ${tokensOr.join(', ') || '(none)'}\n- rangeDays: ${rangeDays}\n- intervalSec: ${intervalSec}\n- hashtag: ${hashTag ?? '(none)'}\n- prefecture: ${prefectures.join(', ') || '(none)'}\n- owner_nickname: ${ownerNickname ?? '(none)'}`,
      ephemeral: true,
    });
    return;
  }

  if (sub === 'sort') {
    const v = interaction.options.getString('order', true);
    const order = v === 'updated_desc' ? 1 : v === 'started_asc' ? 2 : 3; // started_desc -> 3
    const existing = await manager.get(jobId);
    const job = await manager.upsert({
      id: jobId,
      channelId: jobId,
      intervalSec: existing?.intervalSec ?? 1800,
      keyword: existing?.keyword,
      keywordOr: existing?.keywordOr,
      rangeDays: existing?.rangeDays ?? 14,
      prefecture: existing?.prefecture,
      hashTag: existing?.hashTag,
      ownerNickname: existing?.ownerNickname,
      order,
    });
    // restart to apply immediately
    await scheduler.restart(jobId);
    const label = order === 1 ? '更新日時の降順 (updated_desc)' : order === 2 ? '開催日時の昇順 (started_asc)' : '開催日時の降順 (started_desc)';
    await interaction.reply({ content: `OK: sort updated to: ${label}`, ephemeral: true });
    return;
  }

  if (sub === 'status') {
    const job = await manager.get(jobId);
    if (!job) {
      await interaction.reply({ content: 'No watch configured for this channel.', ephemeral: true });
      return;
    }
    await interaction.reply({
      content:
        `Watch status:\n` +
        `- keywords(and): ${(job.keyword ?? []).join(', ') || '(none)'}\n` +
        `- keywords(or): ${(job.keywordOr ?? []).join(', ') || '(none)'}\n` +
        `- rangeDays: ${job.rangeDays}\n` +
        `- intervalSec: ${job.intervalSec}\n` +
        `- hashtag: ${job.hashTag ?? '(none)'}\n` +
        `- owner_nickname: ${job.ownerNickname ?? '(none)'}\n` +
        `- order: ${job.order ?? 2} ` +
        `(${(job.order ?? 2) === 1 ? 'updated_desc' : (job.order ?? 2) === 2 ? 'started_asc' : 'started_desc'})\n` +
        `- prefecture: ${(job.prefecture ?? []).join(', ') || '(none)'}\n` +
        `- lastRunAt: ${job.state.lastRunAt ? new Date(job.state.lastRunAt).toLocaleString() : '(never)'}\n` +
        `- lastEventUpdatedAt: ${job.state.lastEventUpdatedAt ?? '(none)'}\n`,
      ephemeral: true,
    });
    return;
  }

  if (sub === 'remove') {
    await scheduler.stop(jobId);
    await manager.remove(jobId);
    await interaction.reply({ content: 'Removed watch for this channel.', ephemeral: true });
    return;
  }

  if (sub === 'run') {
    try {
      const res = await manager.runOnce(jobId);
      await interaction.reply({ content: `Ran. Found ${res.events.length} events matching current filters.`, ephemeral: true });
    } catch (e: any) {
      await interaction.reply({ content: `Error: ${e?.message ?? e}`, ephemeral: true });
    }
    return;
  }

  if (sub === 'today') {
    const user = await userManager.find(interaction.user.id);
    if (!user) {
      await interaction.reply({ content: 'Your connpass nickname is not registered. Use `/connpass user register` first.', ephemeral: true });
      return;
    }

    // Use local date (not UTC) to avoid off-by-one around midnight
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const ymd = `${yyyy}${mm}${dd}`;
    const resp = await api.searchEvents({ nickname: user.connpassNickname, ymd: [ymd] });

    if (resp.events.length === 0) {
      await interaction.reply({ content: 'No events found for you today.', ephemeral: true });
      return;
    }

    const toDate = (s?: string) => {
      if (!s) return undefined;
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? undefined : d;
    };
    const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    const sorted = [...resp.events].sort((a, b) => {
      const sa = toDate(a.startedAt);
      const sb = toDate(b.startedAt);
      if (sa && sb) return sa.getTime() - sb.getTime();
      if (sa && !sb) return -1;
      if (!sa && sb) return 1;
      return a.title.localeCompare(b.title);
    });

    const lines = sorted.map((e) => {
      const s = toDate(e.startedAt);
      const t = toDate(e.endedAt);
      const time = s ? t ? `${hhmm(s)}-${hhmm(t)}` : `${hhmm(s)}` : '';
      const head = time ? `${time} ` : '';
      return `- ${head}${e.title} ${e.url}`;
    });

    await interaction.reply({ content: `Your schedule for today:\n${lines.join('\n')}`, ephemeral: true });
    return;
  }
}
