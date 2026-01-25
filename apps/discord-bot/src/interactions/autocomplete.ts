import type { AutocompleteInteraction } from 'discord.js';
import { filterPrefectures } from '../data/prefectures.js';
import { getAIConfig } from '../ai/index.js';
import type { AIProvider } from '@connpass-discord-bot/core';

/**
 * スケジュールプリセット
 */
const SCHEDULE_PRESETS = [
  { name: '毎日 9:00', value: '0 9 * * *' },
  { name: '毎日 12:00', value: '0 12 * * *' },
  { name: '毎日 18:00', value: '0 18 * * *' },
  { name: '平日 9:00', value: '0 9 * * 1-5' },
  { name: '毎週月曜 9:00', value: '0 9 * * 1' },
  { name: '毎週金曜 18:00', value: '0 18 * * 5' },
];

/**
 * ソート順プリセット
 */
const ORDER_PRESETS = [
  { name: '開始日時（早い順）', value: 'started_asc' },
  { name: '開始日時（遅い順）', value: 'started_desc' },
  { name: '更新日時（新しい順）', value: 'updated_desc' },
];

/**
 * オートコンプリートハンドラー
 */
export async function handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);

  if (focused.name === 'location') {
    const query = focused.value;
    const filtered = filterPrefectures(query);
    await interaction.respond(filtered);
    return;
  }

  if (focused.name === 'schedule') {
    const query = focused.value.toLowerCase();
    // 入力がない場合はプリセットを表示
    if (!query) {
      await interaction.respond(SCHEDULE_PRESETS);
      return;
    }
    // 入力がある場合は、プリセットからフィルタしつつ、入力値自体も候補に追加
    const filtered = SCHEDULE_PRESETS.filter(
      (preset) =>
        preset.name.toLowerCase().includes(query) ||
        preset.value.toLowerCase().includes(query)
    );
    // 入力値がプリセットにない場合は、入力値自体を候補として追加
    const isExactMatch = SCHEDULE_PRESETS.some((p) => p.value === focused.value);
    if (!isExactMatch && focused.value.trim()) {
      filtered.unshift({ name: `カスタム: ${focused.value}`, value: focused.value });
    }
    await interaction.respond(filtered.slice(0, 25));
    return;
  }

  if (focused.name === 'order') {
    const query = focused.value.toLowerCase();
    // 入力がない場合はプリセットを表示
    if (!query) {
      await interaction.respond(ORDER_PRESETS);
      return;
    }
    // 入力がある場合はフィルタ
    const filtered = ORDER_PRESETS.filter(
      (preset) =>
        preset.name.toLowerCase().includes(query) ||
        preset.value.toLowerCase().includes(query)
    );
    // 入力値がプリセットにない場合は、入力値自体を候補として追加
    const isExactMatch = ORDER_PRESETS.some((p) => p.value === focused.value);
    if (!isExactMatch && focused.value.trim()) {
      filtered.unshift({ name: focused.value, value: focused.value });
    }
    await interaction.respond(filtered.slice(0, 25));
    return;
  }

  if (focused.name === 'model') {
    const provider = interaction.options.getString('provider') as AIProvider | null;
    if (!provider) {
      await interaction.respond([]);
      return;
    }

    const aiConfig = getAIConfig();
    const allowedModels = aiConfig.allowedModels[provider] || [];
    const query = focused.value.toLowerCase();

    const filtered = allowedModels
      .filter(model => model.toLowerCase().includes(query))
      .slice(0, 25)
      .map(model => ({ name: model, value: model }));

    await interaction.respond(filtered);
  }
}
