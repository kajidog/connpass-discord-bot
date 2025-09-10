import { SlashCommandBuilder, ChatInputCommandInteraction, CacheType } from 'discord.js';
import { JobManager, JobScheduler } from '@connpass-discord-bot/job';

export const commandData = new SlashCommandBuilder()
  .setName('connpass')
  .setDescription('Manage Connpass watch jobs for this channel')
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Add or update a watch for this channel')
      .addIntegerOption((o) => o.setName('interval_sec').setDescription('Interval seconds (default 1800)').setMinValue(60))
      .addStringOption((o) => o.setName('mode').setDescription('Keyword match mode: and|or').addChoices(
        { name: 'and', value: 'and' },
        { name: 'or', value: 'or' },
      ))
      .addStringOption((o) => o.setName('keywords').setDescription('Comma or space separated keywords'))
      .addIntegerOption((o) => o.setName('range_days').setDescription('Days from now to search (default 14)').setMinValue(1).setMaxValue(90))
      .addStringOption((o) => o.setName('location').setDescription('Filter by location (place/address contains)'))
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
  .toJSON();

export async function handleCommand(interaction: ChatInputCommandInteraction<CacheType>, manager: JobManager, scheduler: JobScheduler) {
  if (!interaction.channelId) {
    await interaction.reply({ content: 'Channel is not available.', ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand(true);
  const jobId = interaction.channelId;

  if (sub === 'set') {
    const intervalSec = interaction.options.getInteger('interval_sec') ?? 1800;
    const mode = (interaction.options.getString('mode') as 'and' | 'or' | null) ?? 'or';
    const keywordsRaw = interaction.options.getString('keywords') ?? '';
    const rangeDays = interaction.options.getInteger('range_days') ?? 14;
    const location = interaction.options.getString('location') ?? undefined;

    const tokens = keywordsRaw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const config = {
      id: jobId,
      channelId: jobId,
      intervalSec,
      mode,
      keyword: mode === 'and' ? tokens : undefined,
      keywordOr: mode === 'or' ? tokens : undefined,
      rangeDays,
      location,
    } as const;

    await manager.upsert(config);
    await scheduler.restart(jobId);
    await interaction.reply({
      content: `OK: watching this channel.\n- mode: ${mode}\n- keywords: ${tokens.join(', ') || '(none)'}\n- rangeDays: ${rangeDays}\n- intervalSec: ${intervalSec}\n- location: ${location ?? '(none)'}`,
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
      mode: existing?.mode ?? 'or',
      keyword: existing?.keyword,
      keywordOr: existing?.keywordOr,
      rangeDays: existing?.rangeDays ?? 14,
      location: existing?.location,
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
        `- mode: ${job.mode}\n` +
        `- keywords(and): ${(job.keyword ?? []).join(', ') || '(none)'}\n` +
        `- keywords(or): ${(job.keywordOr ?? []).join(', ') || '(none)'}\n` +
        `- rangeDays: ${job.rangeDays}\n` +
        `- intervalSec: ${job.intervalSec}\n` +
        `- order: ${job.order ?? 2} ` +
        `(${(job.order ?? 2) === 1 ? 'updated_desc' : (job.order ?? 2) === 2 ? 'started_asc' : 'started_desc'})\n` +
        `- location: ${job.location ?? '(none)'}\n` +
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
}
