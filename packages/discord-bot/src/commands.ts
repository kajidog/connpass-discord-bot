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
  .addSubcommand((sub) => sub.setName('status').setDescription('Show current watch settings for this channel'))
  .addSubcommand((sub) => sub.setName('peek').setDescription('Fetch and show events without sending to channel'))
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

  if (sub === 'peek') {
    try {
      const res = await manager.peekOnce(jobId);
      if (res.events.length === 0) {
        await interaction.reply({ content: 'No events found matching current filters.', ephemeral: true });
        return;
      }

      const eventSummaries = res.events
        .slice(0, 5)
        .map((e) => `- ${e.title} (${e.url})`)
        .join('\n');
      const moreCount = res.events.length > 5 ? res.events.length - 5 : 0;

      let content = `Found ${res.events.length} events matching current filters.\n\n`;
      content += eventSummaries;
      if (moreCount > 0) {
        content += `\n... and ${moreCount} more.`;
      }

      await interaction.reply({ content, ephemeral: true });
    } catch (e: any) {
      await interaction.reply({ content: `Error: ${e?.message ?? e}`, ephemeral: true });
    }
    return;
  }
}

