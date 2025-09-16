import { SlashCommandBuilder, ChatInputCommandInteraction, CacheType } from 'discord.js';
import { JobManager, JobScheduler, UserManager } from '@connpass-discord-bot/job';
import { ConnpassClient } from '@connpass-discord-bot/api-client';

export const commandData = new SlashCommandBuilder()
  .setName('connpass')
  .setDescription('Manage Connpass feeds for this channel')
  .addSubcommandGroup((group) =>
    group
      .setName('feed')
      .setDescription('Manage feed settings for this channel')
      .addSubcommand((sub) =>
        sub
          .setName('set')
          .setDescription('Add or update feed settings for this channel')
          .addIntegerOption((o) => o.setName('interval_sec').setDescription('Interval seconds (default 1800)').setMinValue(60))
          .addStringOption((o) => o.setName('keywords_and').setDescription('Keywords (AND). Comma or space separated'))
          .addStringOption((o) => o.setName('keywords_or').setDescription('Keywords (OR). Comma or space separated'))
          .addIntegerOption((o) => o.setName('range_days').setDescription('Days from now to search (default 14)').setMinValue(1).setMaxValue(120))
          .addStringOption((o) =>
            o
              .setName('location')
              .setDescription('Filter by prefecture (autocomplete; comma/space separated)')
              .setAutocomplete(true)
          )
          .addStringOption((o) => o.setName('hashtag').setDescription('Filter by hashtag (e.g. typescript, no #)'))
          .addStringOption((o) => o.setName('owner_nickname').setDescription('Filter by owner nickname'))
          .addStringOption((o) =>
            o
              .setName('order')
              .setDescription('Sort: updated_desc | started_asc | started_desc (optional)')
              .addChoices(
                { name: '更新日時の降順 (updated_desc)', value: 'updated_desc' },
                { name: '開催日時の昇順 (started_asc)', value: 'started_asc' },
                { name: '開催日時の降順 (started_desc)', value: 'started_desc' },
              )
          )
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
      .addSubcommand((sub) => sub.setName('status').setDescription('Show current feed settings for this channel'))
      .addSubcommand((sub) => sub.setName('remove').setDescription('Remove feed settings for this channel'))
      .addSubcommand((sub) => sub.setName('run').setDescription('Run once immediately'))
  )
  .addSubcommandGroup((group) =>
    group
      .setName('report')
      .setDescription('Generate a consolidated report or configure AI summary')
      .addSubcommand((sub) =>
        sub
          .setName('run')
          .setDescription('Generate a consolidated report and post it to this channel')
          .addBooleanOption((o) => o.setName('ai').setDescription('Use AI summary (Mastra AgentAPI) for this run'))
          .addStringOption((o) => o.setName('summary_template').setDescription('How to summarize (overrides channel default)'))
          .addStringOption((o) => o.setName('keywords_and').setDescription('Keywords (AND). Comma or space separated'))
          .addStringOption((o) => o.setName('keywords_or').setDescription('Keywords (OR). Comma or space separated'))
          .addIntegerOption((o) => o.setName('range_days').setDescription('Days from now to search (default 7)').setMinValue(1).setMaxValue(120))
          .addStringOption((o) =>
            o
              .setName('location')
              .setDescription('Filter by prefecture (autocomplete; comma/space separated)')
              .setAutocomplete(true)
          )
          .addStringOption((o) => o.setName('hashtag').setDescription('Filter by hashtag (e.g. typescript, no #)'))
          .addStringOption((o) => o.setName('owner_nickname').setDescription('Filter by owner nickname'))
          .addStringOption((o) =>
            o
              .setName('order')
              .setDescription('Sort: updated_desc | started_asc | started_desc (default started_asc)')
              .addChoices(
                { name: '更新日時の降順 (updated_desc)', value: 'updated_desc' },
                { name: '開催日時の昇順 (started_asc)', value: 'started_asc' },
                { name: '開催日時の降順 (started_desc)', value: 'started_desc' },
              )
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName('set')
          .setDescription('Set AI summary and scheduled report settings for this channel')
          .addBooleanOption((o) => o.setName('enabled').setDescription('Enable scheduled reports'))
          .addIntegerOption((o) => o.setName('interval_sec').setDescription('Report interval seconds (default 86400)').setMinValue(60))
          .addIntegerOption((o) => o.setName('range_days').setDescription('Days from now to include (default 7)').setMinValue(1).setMaxValue(120))
          .addStringOption((o) => o.setName('keywords_and').setDescription('Report keywords (AND). Comma or space separated'))
          .addStringOption((o) => o.setName('keywords_or').setDescription('Report keywords (OR). Comma or space separated'))
          .addStringOption((o) =>
            o
              .setName('location')
              .setDescription('Report filter by prefecture (autocomplete; comma/space separated)')
              .setAutocomplete(true)
          )
          .addStringOption((o) => o.setName('hashtag').setDescription('Report filter by hashtag (e.g. typescript, no #)'))
          .addStringOption((o) => o.setName('owner_nickname').setDescription('Report filter by owner nickname'))
          .addStringOption((o) =>
            o
              .setName('order')
              .setDescription('Report sort: updated_desc | started_asc | started_desc (optional)')
              .addChoices(
                { name: '更新日時の降順 (updated_desc)', value: 'updated_desc' },
                { name: '開催日時の昇順 (started_asc)', value: 'started_asc' },
                { name: '開催日時の降順 (started_desc)', value: 'started_desc' },
              )
          )
          .addBooleanOption((o) => o.setName('ai_enabled').setDescription('Default ON/OFF for AI summary'))
          .addStringOption((o) => o.setName('summary_template').setDescription('How to summarize (system prompt style)'))
      )
      .addSubcommand((sub) =>
        sub
          .setName('status')
          .setDescription('Show current report schedule and AI settings for this channel')
      )
  )
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

  // Feed group: settings and operations for periodic feed
  if (group === 'feed' && sub === 'set') {
    const intervalSec = interaction.options.getInteger('interval_sec') ?? 1800;
    const keywordsAndRaw = interaction.options.getString('keywords_and') ?? '';
    const keywordsOrRaw = interaction.options.getString('keywords_or') ?? '';
    const rangeDays = interaction.options.getInteger('range_days') ?? 14;
    const locationRaw = interaction.options.getString('location') ?? '';
    const orderOpt = interaction.options.getString('order') as 'updated_desc' | 'started_asc' | 'started_desc' | null;
    const order = orderOpt === 'updated_desc' ? 1 : orderOpt === 'started_asc' ? 2 : orderOpt === 'started_desc' ? 3 : undefined;
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
      order,
    } as const;

    await manager.upsert(config);
    await scheduler.restart(jobId);
    await interaction.reply({
      content:
        `設定を更新しました (/connpass feed set)\n` +
        `- keywords(and): ${tokensAnd.join(', ') || '(none)'}\n` +
        `- keywords(or): ${tokensOr.join(', ') || '(none)'}\n` +
        `- rangeDays: ${rangeDays}\n` +
        `- intervalSec: ${intervalSec}\n` +
        `- hashtag: ${hashTag ?? '(none)'}\n` +
        `- prefecture: ${prefectures.join(', ') || '(none)'}\n` +
        `- owner_nickname: ${ownerNickname ?? '(none)'}\n` +
        (order != null
          ? `- order: ${order === 1 ? '更新日時の降順 (updated_desc)' : order === 2 ? '開催日時の昇順 (started_asc)' : '開催日時の降順 (started_desc)'}\n`
          : ''),
      ephemeral: true,
    });
    return;
  }

  if (group === 'feed' && sub === 'sort') {
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
    // restart scheduler to apply on next interval (no immediate run)
    await scheduler.restart(jobId);
    const label = order === 1 ? '更新日時の降順 (updated_desc)' : order === 2 ? '開催日時の昇順 (started_asc)' : '開催日時の降順 (started_desc)';
    await interaction.reply({ content: `並び順を更新しました(/connpass feed sort) \n - order: ${ label } `, ephemeral: true });
    return;
  }

  if (group === 'feed' && sub === 'status') {
    const job = await manager.get(jobId);
    if (!job) {
      await interaction.reply({ content: 'No feed configured for this channel.', ephemeral: true });
      return;
    }
    await interaction.reply({
      content:
        `監視設定(/connpass feed status) \n` +
        `- keywords(and): ${ (job.keyword ?? []).join(', ') || '(none)' } \n` +
        `- keywords(or): ${ (job.keywordOr ?? []).join(', ') || '(none)' } \n` +
        `- rangeDays: ${ job.rangeDays } \n` +
        `- intervalSec: ${ job.intervalSec } \n` +
        `- hashtag: ${ job.hashTag ?? '(none)' } \n` +
        `- owner_nickname: ${ job.ownerNickname ?? '(none)' } \n` +
        `- order: ${ (job.order ?? 2) === 1 ? '更新日時の降順 (updated_desc)' : (job.order ?? 2) === 2 ? '開催日時の昇順 (started_asc)' : '開催日時の降順 (started_desc)' } \n` +
        `- prefecture: ${ (job.prefecture ?? []).join(', ') || '(none)' } \n` +
        `- lastRunAt: ${ job.state.lastRunAt ? new Date(job.state.lastRunAt).toLocaleString() : '(never)' } \n` +
        `- lastEventUpdatedAt: ${ job.state.lastEventUpdatedAt ?? '(none)' } \n`,
      ephemeral: true,
    });
    return;
  }

  if (group === 'feed' && sub === 'remove') {
    await scheduler.stop(jobId);
    await manager.remove(jobId);
    await interaction.reply({ content: '監視を削除しました (/connpass feed remove)', ephemeral: true });
    return;
  }

  if (group === 'feed' && sub === 'run') {
    try {
      const existing = await manager.get(jobId);
      const res = await manager.runOnce(jobId);
      const keywordsAnd = existing?.keyword ?? [];
      const keywordsOr = existing?.keywordOr ?? [];
      const rangeDays = existing?.rangeDays ?? 14;
      const intervalSec = existing?.intervalSec ?? 1800;
      const hashTag = existing?.hashTag ?? undefined;
      const ownerNickname = existing?.ownerNickname ?? undefined;
      const prefecture = existing?.prefecture ?? [];
      const order = existing?.order ?? 2;
      const orderLabel = order === 1 ? '更新日時の降順 (updated_desc)' : order === 2 ? '開催日時の昇順 (started_asc)' : '開催日時の降順 (started_desc)';

      await interaction.reply({
        content:
          `手動実行しました(/connpass feed run) \n` +
          `- 検索一致: ${ res.events.length } 件（通知は新着のみ）\n` +
          `- keywords(and): ${ keywordsAnd.join(', ') || '(none)' } \n` +
          `- keywords(or): ${ keywordsOr.join(', ') || '(none)' } \n` +
          `- rangeDays: ${ rangeDays } \n` +
          `- intervalSec: ${ intervalSec } \n` +
          `- hashtag: ${ hashTag ?? '(none)' } \n` +
          `- owner_nickname: ${ ownerNickname ?? '(none)' } \n` +
          `- order: ${ orderLabel } \n` +
          `- prefecture: ${ prefecture.join(', ') || '(none)' } `,
        ephemeral: true,
      });
    } catch (e: any) {
      await interaction.reply({ content: `Error: ${ e?.message ?? e } `, ephemeral: true });
    }
    return;
  }

  // Report group (run/set/status) with optional AI summary via Mastra Agent API
  if (group === 'report') {
    const sub2 = sub; // run | set | status

    // helpers
    const splitForDiscord = (text: string, maxLen = 1900): string[] => {
      const chunks: string[] = [];
      const push = (s: string) => { if (s.trim().length) chunks.push(s.trimEnd()); };
      if (text.length <= maxLen) return [text];
      const paragraphs = text.split(/\n\n+/);
      let buf = '';
      for (const p of paragraphs) {
        const para = p + '\n\n';
        if (para.length > maxLen) {
          const lines = p.split(/\n/);
          for (const line of lines) {
            const l = line + '\n';
            if ((buf + l).length > maxLen) {
              push(buf);
              buf = '';
            }
            if (l.length > maxLen) {
              let rest = l;
              while (rest.length > 0) {
                let cut = Math.min(maxLen - (buf.length || 0), rest.length);
                const head = rest.slice(0, cut);
                let idx = Math.max(head.lastIndexOf('。'), head.lastIndexOf('\n'));
                if (idx < 0) idx = Math.max(head.lastIndexOf('、'), head.lastIndexOf(' '));
                if (idx > 20) cut = idx + 1;
                const piece = rest.slice(0, cut);
                if ((buf + piece).length > maxLen) { push(buf); buf = ''; }
                buf += piece;
                push(buf);
                buf = '';
                rest = rest.slice(cut);
              }
            } else {
              buf += l;
            }
          }
        } else {
          if ((buf + para).length > maxLen) { push(buf); buf = ''; }
          buf += para;
        }
      }
      push(buf);
      return chunks;
    };

    const callMastraAgent = async (agentId: string, baseUrl: string, userText: string, systemText?: string): Promise<string> => {
      const url = `${baseUrl.replace(/\/$/, '')}/api/agents/${encodeURIComponent(agentId)}/generate`;
      const body = {
        messages: [
          ...(systemText ? [{ role: 'system', content: systemText }] : []),
          { role: 'user', content: userText },
        ],
      } as any;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Mastra API error: ${res.status} ${res.statusText}`);
      const data: any = await res.json().catch(() => null);
      if (data && typeof data.text === 'string') return data.text as string;
      const text = data?.output?.text ?? data?.response?.text ?? '';
      if (typeof text === 'string' && text) return text;
      const raw = await res.text().catch(() => '');
      return raw || 'AI要約の生成に失敗しました。';
    };

    if (sub2 === 'set') {
      const aiEnabled = interaction.options.getBoolean('ai_enabled');
      const summaryTemplate = interaction.options.getString('summary_template') ?? undefined;
      const enabled = interaction.options.getBoolean('enabled');
      const intervalSec = interaction.options.getInteger('interval_sec') ?? undefined;
      const rangeDays = interaction.options.getInteger('range_days') ?? undefined;

      // report-specific filters
      const keywordsAndRaw = interaction.options.getString('keywords_and') ?? '';
      const keywordsOrRaw = interaction.options.getString('keywords_or') ?? '';
      const locationRaw = interaction.options.getString('location') ?? '';
      const orderOpt = interaction.options.getString('order') as 'updated_desc' | 'started_asc' | 'started_desc' | null;
      const order = orderOpt === 'updated_desc' ? 1 : orderOpt === 'started_asc' ? 2 : orderOpt === 'started_desc' ? 3 : undefined;
      const prefectures = locationRaw
        .split(/[\,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const hashTagOpt = interaction.options.getString('hashtag') ?? undefined;
      const hashTag = hashTagOpt ? hashTagOpt.replace(/^#/, '').trim() || undefined : undefined;
      const ownerNickname = interaction.options.getString('owner_nickname') ?? undefined;
      const tokensAnd = keywordsAndRaw
        .split(/[\,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const tokensOr = keywordsOrRaw
        .split(/[\,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const existing = await manager.get(jobId);
      const job = await manager.upsert({
        id: jobId,
        channelId: jobId,
        intervalSec: existing?.intervalSec ?? 1800,
        reportAiDefault: aiEnabled ?? existing?.reportAiDefault,
        reportSummaryTemplate: summaryTemplate ?? existing?.reportSummaryTemplate,
        // below: scheduled report config (cast to any for forward-compat types)
        ...( { reportEnabled: enabled ?? (existing as any)?.reportEnabled ?? false } as any ),
        ...( { reportIntervalSec: intervalSec ?? (existing as any)?.reportIntervalSec ?? 24 * 60 * 60 } as any ),
        ...( { reportRangeDays: rangeDays ?? (existing as any)?.reportRangeDays ?? 7 } as any ),
        // report-specific filters
        ...( tokensAnd.length ? ({ reportKeyword: tokensAnd } as any) : {} ),
        ...( tokensOr.length ? ({ reportKeywordOr: tokensOr } as any) : {} ),
        ...( prefectures.length ? ({ reportPrefecture: prefectures } as any) : {} ),
        ...( hashTag !== undefined ? ({ reportHashTag: hashTag } as any) : {} ),
        ...( ownerNickname ? ({ reportOwnerNickname: ownerNickname } as any) : {} ),
        ...( order != null ? ({ reportOrder: order } as any) : {} ),
      } as any);
      // restart scheduler to apply on next interval (no immediate run)
      await scheduler.restart(jobId);
      await interaction.reply({
        content:
          'レポート設定を更新しました (/connpass report set)\n' +
          `- schedule.enabled: ${ (job as any).reportEnabled ? 'ON' : 'OFF'}\n` +
          `- schedule.intervalSec: ${ (job as any).reportIntervalSec }\n` +
          `- schedule.rangeDays: ${ (job as any).reportRangeDays }\n` +
          `- filters.keywords(and): ${ ((job as any).reportKeyword ?? []).join(', ') || '(inherit feed / none)'}\n` +
          `- filters.keywords(or): ${ ((job as any).reportKeywordOr ?? []).join(', ') || '(inherit feed / none)'}\n` +
          `- filters.prefecture: ${ ((job as any).reportPrefecture ?? []).join(', ') || '(inherit feed / none)'}\n` +
          `- filters.hashtag: ${ (job as any).reportHashTag ?? '(inherit feed / none)'}\n` +
          `- filters.owner_nickname: ${ (job as any).reportOwnerNickname ?? '(inherit feed / none)'}\n` +
          `- order: ${ ((job as any).reportOrder ?? (job as any).order ?? 2) === 1 ? 'updated_desc' : ((job as any).reportOrder ?? (job as any).order ?? 2) === 2 ? 'started_asc' : 'started_desc' }\n` +
          `- ai_enabled: ${job.reportAiDefault ? 'ON' : 'OFF'}\n` +
          `- summary_template: ${job.reportSummaryTemplate ? job.reportSummaryTemplate.slice(0, 140) + (job.reportSummaryTemplate.length > 140 ? '…' : '') : '(none)'}\n`,
        ephemeral: true,
      });
      return;
    }

    if (sub2 === 'status') {
      const job = await manager.get(jobId);
      await interaction.reply({
        content:
          'レポート設定の現在値 (/connpass report status)\n' +
          `- schedule.enabled: ${ (job as any)?.reportEnabled ? 'ON' : 'OFF'}\n` +
          `- schedule.intervalSec: ${ (job as any)?.reportIntervalSec ?? '(default)'}\n` +
          `- schedule.rangeDays: ${ (job as any)?.reportRangeDays ?? '(default)'}\n` +
          `- filters.keywords(and): ${ (((job as any)?.reportKeyword) ?? []).join(', ') || '(inherit feed / none)'}\n` +
          `- filters.keywords(or): ${ (((job as any)?.reportKeywordOr) ?? []).join(', ') || '(inherit feed / none)'}\n` +
          `- filters.prefecture: ${ (((job as any)?.reportPrefecture) ?? []).join(', ') || '(inherit feed / none)'}\n` +
          `- filters.hashtag: ${ ((job as any)?.reportHashTag) ?? '(inherit feed / none)'}\n` +
          `- filters.owner_nickname: ${ ((job as any)?.reportOwnerNickname) ?? '(inherit feed / none)'}\n` +
          `- order: ${ (((job as any)?.reportOrder ?? (job as any)?.order ?? 2) === 1) ? 'updated_desc' : (((job as any)?.reportOrder ?? (job as any)?.order ?? 2) === 2) ? 'started_asc' : 'started_desc' }\n` +
          `- ai_enabled: ${job?.reportAiDefault ? 'ON' : 'OFF'}\n` +
          `- summary_template: ${job?.reportSummaryTemplate ? job.reportSummaryTemplate.slice(0, 280) + (job.reportSummaryTemplate.length > 280 ? '…' : '') : '(none)'}\n`,
        ephemeral: true,
      });
      return;
    }

    if (sub2 === 'run') {
      // Defaults: report-specific -> feed -> options
      const aiOpt = interaction.options.getBoolean('ai');
      const templateOverride = interaction.options.getString('summary_template') ?? undefined;
      const existing = await manager.get(jobId);
      const orderOpt = interaction.options.getString('order') as 'updated_desc' | 'started_asc' | 'started_desc' | null;
      const order = orderOpt === 'updated_desc'
        ? 1
        : orderOpt === 'started_asc'
          ? 2
          : orderOpt === 'started_desc'
            ? 3
            : ((existing as any)?.reportOrder ?? (existing?.order ?? 2));
      const rangeDays = interaction.options.getInteger('range_days') ?? ((existing as any)?.reportRangeDays ?? 7);
      const keywordsAndRaw = interaction.options.getString('keywords_and') ?? (((existing as any)?.reportKeyword ?? existing?.keyword ?? []) as string[]).join(', ');
      const keywordsOrRaw = interaction.options.getString('keywords_or') ?? (((existing as any)?.reportKeywordOr ?? existing?.keywordOr ?? []) as string[]).join(', ');
      const locationRaw = interaction.options.getString('location') ?? (((existing as any)?.reportPrefecture ?? existing?.prefecture ?? []) as string[]).join(', ');
      const hashTagOpt = interaction.options.getString('hashtag') ?? ((existing as any)?.reportHashTag ?? existing?.hashTag ?? undefined);
      const ownerNickname = interaction.options.getString('owner_nickname') ?? ((existing as any)?.reportOwnerNickname ?? existing?.ownerNickname ?? undefined);
      const prefectures = locationRaw
        .split(/[\,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const hashTag = typeof hashTagOpt === 'string' ? (hashTagOpt ? hashTagOpt.replace(/^#/, '').trim() || undefined : undefined) : undefined;
      const tokensAnd = keywordsAndRaw
        .split(/[\,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const tokensOr = keywordsOrRaw
        .split(/[\,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const aiEnabled = aiOpt ?? existing?.reportAiDefault ?? false;
      const summaryTemplate = templateOverride ?? existing?.reportSummaryTemplate ?? undefined;

      await interaction.deferReply();
      try {
        // Build ymd range (local time)
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const from = `${yyyy}-${mm}-${dd}`;
        const toD = new Date(now);
        toD.setDate(now.getDate() + rangeDays);
        const tyyyy = toD.getFullYear();
        const tmm = String(toD.getMonth() + 1).padStart(2, '0');
        const tdd = String(toD.getDate()).padStart(2, '0');
        const to = `${tyyyy}-${tmm}-${tdd}`;

        const params: any = { ymdFrom: from, ymdTo: to, order };
        if (tokensAnd.length) params.keyword = tokensAnd;
        if (tokensOr.length) params.keywordOr = tokensOr;
        if (prefectures.length) params.prefecture = prefectures;
        if (ownerNickname) params.ownerNickname = ownerNickname;

        const resp = await api.getAllEvents(params);
        const filtered = (hashTag ? resp.events.filter((e) => (e.hashTag ?? '').replace(/^#/, '').toLowerCase() === (hashTag ?? '').toLowerCase()) : resp.events);

        let events = filtered;
        const toDateTime = (s?: string) => {
          if (!s) return undefined;
          const d = new Date(s);
          return Number.isNaN(d.getTime()) ? undefined : d;
        };
        if (order === 2) {
          events = [...events].sort((a, b) => {
            const sa = toDateTime(a.startedAt);
            const sb = toDateTime(b.startedAt);
            if (sa && sb) return sa.getTime() - sb.getTime();
            if (sa && !sb) return -1;
            if (!sa && sb) return 1;
            return a.title.localeCompare(b.title);
          });
        } else if (order === 3) {
          events = [...events].sort((a, b) => {
            const sa = toDateTime(a.startedAt);
            const sb = toDateTime(b.startedAt);
            if (sa && sb) return sb.getTime() - sa.getTime();
            if (sa && !sb) return -1;
            if (!sa && sb) return 1;
            return a.title.localeCompare(b.title);
          });
        } else {
          events = [...events].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        }

        const orderLabel = order === 1 ? 'updated_desc' : order === 2 ? 'started_asc' : 'started_desc';
        const baseHeader = [
          `レポート(${events.length}件)`,
          `期間: ${from} 〜 ${to}`,
          `条件: keywords(and)=${tokensAnd.join(', ') || '(none)'} | keywords(or)=${tokensOr.join(', ') || '(none)'} | hashtag=${hashTag ?? '(none)'} | prefecture=${prefectures.join(', ') || '(none)'} | owner=${ownerNickname ?? '(none)'} | order=${orderLabel}`,
        ].join('\n');

        if (events.length === 0) {
          await interaction.editReply(`${baseHeader}\n\n該当イベントはありませんでした。`);
          return;
        }

        if (aiEnabled) {
          const baseUrl = process.env.MASTRA_BASE_URL || 'http://localhost:4111';
          const payload = {
            meta: {
              range: { from, to },
              filters: { and: tokensAnd, or: tokensOr, hashTag, prefectures, ownerNickname, order: orderLabel },
            },
            events: events.map((e) => ({
              id: e.id,
              title: e.title,
              url: e.url,
              group: e.groupTitle,
              startedAt: e.startedAt,
              endedAt: e.endedAt,
              updatedAt: e.updatedAt,
              place: e.place,
              address: e.address,
              limit: e.limit,
              participantCount: e.participantCount,
              hashTag: e.hashTag,
              ownerDisplayName: e.ownerDisplayName || e.ownerNickname,
            })),
          };

          const system = [
            'あなたはConnpassのイベント一覧をディスコード投稿向けに日本語でわかりやすく要約します。',
            '重要: 箇条書きや小見出しを活用し、似たイベントはグルーピング、日付順に整理。',
            'URLは各イベントに1つ添付。余計な前置きは不要。',
            summaryTemplate ? `追加指示: ${summaryTemplate}` : '',
          ].filter(Boolean).join('\n');
          const user = `以下のJSONのイベントを、チャンネル投稿用の要約にしてください。\n${JSON.stringify(payload, null, 2)}`;

          const aiText = await callMastraAgent('connpassAgent', baseUrl, user, system);
          const chunks = splitForDiscord(`${baseHeader}\n\n${aiText}`);
          await interaction.editReply(chunks[0]);
          for (let i = 1; i < chunks.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            await interaction.followUp(chunks[i]);
          }
          return;
        }

        // Non-AI fallback
        const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const ymd2 = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
        const lines: string[] = [];
        for (const e of events) {
          const s = toDateTime(e.startedAt);
          const t = toDateTime(e.endedAt);
          const time = s ? (t ? `${ymd2(s)} ${hhmm(s)} - ${hhmm(t)}` : `${ymd2(s)} ${hhmm(s)}`) : '';
          const head = time ? `${time} ` : '';
          const group = e.groupTitle ? ` [${e.groupTitle}]` : '';
          lines.push(`- ${head}${e.title}${group} ${e.url}`);
        }
        const chunks = splitForDiscord(`${baseHeader}\n\n${lines.join('\n')}`);
        await interaction.editReply(chunks[0]);
        for (let i = 1; i < chunks.length; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          await interaction.followUp(chunks[i]);
        }
      } catch (e: any) {
        await interaction.editReply(`エラー: ${e?.message ?? e}`);
      }
      return;
    }

    return;
  }

  if (sub === 'report__legacy_disabled') {
    // Broader defaults and consolidated posting
    const keywordsAndRaw = interaction.options.getString('keywords_and') ?? '';
    const keywordsOrRaw = interaction.options.getString('keywords_or') ?? '';
    const rangeDays = interaction.options.getInteger('range_days') ?? 30;
    const locationRaw = interaction.options.getString('location') ?? '';
    const orderOpt = interaction.options.getString('order') as 'updated_desc' | 'started_asc' | 'started_desc' | null;
    const order = orderOpt === 'updated_desc' ? 1 : orderOpt === 'started_desc' ? 3 : 2; // default started_asc -> 2
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

    const now = new Date();
    const ymd = (d: Date) => `${ d.getFullYear() } -${ String(d.getMonth() + 1).padStart(2, '0') } -${ String(d.getDate()).padStart(2, '0') } `;
    const from = ymd(now);
    const toDate = new Date(now);
    toDate.setDate(now.getDate() + rangeDays);
    const to = ymd(toDate);

    // Build params similar to JobManager but ad-hoc
    const params: any = { ymdFrom: from, ymdTo: to, order };
    if (tokensAnd.length) params.keyword = tokensAnd;
    if (tokensOr.length) params.keywordOr = tokensOr;
    if (prefectures.length) params.prefecture = prefectures;
    if (ownerNickname) params.ownerNickname = ownerNickname;

    await interaction.deferReply();
    try {
      // Fetch all pages to consolidate
      const resp = await api.getAllEvents(params);
      let events = resp.events;
      if (hashTag) {
        const norm = (s?: string) => (s ? s.trim().replace(/^#/, '').toLowerCase() : '');
        const wanted = norm(hashTag);
        events = events.filter((e) => norm(e.hashTag) === wanted);
      }

      if (events.length === 0) {
        await interaction.editReply('レポート: 該当イベントはありませんでした。');
        return;
      }

      // Sort again if needed to enforce label
      const orderVal = order;
      const toDateTime = (s?: string) => {
        if (!s) return undefined;
        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? undefined : d;
      };
      if (orderVal === 2) {
        events.sort((a, b) => {
          const sa = toDateTime(a.startedAt);
          const sb = toDateTime(b.startedAt);
          if (sa && sb) return sa.getTime() - sb.getTime();
          if (sa && !sb) return -1;
          if (!sa && sb) return 1;
          return a.title.localeCompare(b.title);
        });
      } else if (orderVal === 3) {
        events.sort((a, b) => {
          const sa = toDateTime(a.startedAt);
          const sb = toDateTime(b.startedAt);
          if (sa && sb) return sb.getTime() - sa.getTime();
          if (sa && !sb) return -1;
          if (!sa && sb) return 1;
          return a.title.localeCompare(b.title);
        });
      } else {
        events.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      }

      const hhmm = (d: Date) => `${ String(d.getHours()).padStart(2, '0') }:${ String(d.getMinutes()).padStart(2, '0') } `;
      const ymd2 = (d: Date) => `${ d.getFullYear() } /${String(d.getMonth() + 1).padStart(2, '0')}/${ String(d.getDate()).padStart(2, '0') } `;
      const header = [
        `レポート(${ events.length }件)`,
        `期間: ${ from } 〜 ${ to } `,
        `条件: keywords(and) = ${ tokensAnd.join(', ') || '(none)' } | keywords(or)=${ tokensOr.join(', ') || '(none)' } | hashtag=${ hashTag ?? '(none)' } | prefecture=${ prefectures.join(', ') || '(none)' } | owner=${ ownerNickname ?? '(none)' } | order=${ orderVal === 1 ? 'updated_desc' : orderVal === 2 ? 'started_asc' : 'started_desc' } `,
        '',
      ];

      const lines: string[] = [];
      for (const e of events) {
        const s = toDateTime(e.startedAt);
        const t = toDateTime(e.endedAt);
        const time = s ? t ? `${ ymd2(s) } ${ hhmm(s) } -${ hhmm(t) } ` : `${ ymd2(s) } ${ hhmm(s) } ` : '';
        const head = time ? `${ time } ` : '';
        const group = e.groupTitle ? ` [${ e.groupTitle }]` : '';
        lines.push(`- ${ head }${ e.title }${ group } ${ e.url } `);
      }

      // Chunking to respect Discord 2000 char limit
      const chunks: string[] = [];
      const maxLen = 1900; // leave headroom
      let buf = header.join('\n');
      for (const line of lines) {
        if ((buf + line + '\n').length > maxLen) {
          chunks.push(buf);
          buf = '';
        }
        buf += line + '\n';
      }
      if (buf.trim().length) chunks.push(buf.trimEnd());

      if (chunks.length === 0) {
        await interaction.editReply('レポート: 生成に失敗しました');
        return;
      }

      // Send first chunk as the reply, rest as follow-ups
      await interaction.editReply(chunks[0]);
      for (let i = 1; i < chunks.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await interaction.followUp(chunks[i]);
      }
    } catch (e: any) {
      await interaction.editReply(`エラー: ${ e?.message ?? e } `);
    }
    return;
  }

  if (sub === 'today') {
    try {
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
        const time = s ? (t ? `${hhmm(s)} - ${hhmm(t)}` : `${hhmm(s)}`) : '';
        const head = time ? `${time} ` : '';
        return `- ${head}${e.title} ${e.url}`;
      });

      await interaction.reply({ content: `Your schedule for today:\n${lines.join('\n')}`, ephemeral: true });
    } catch (e: any) {
      await interaction.reply({ content: `Error fetching today's events: ${e?.message ?? e}`, ephemeral: true });
    }
    return;
  }
}
