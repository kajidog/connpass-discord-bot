import type { AutocompleteInteraction } from 'discord.js';
import { filterPrefectures } from '../data/prefectures.js';
import { getAIConfig } from '../ai/index.js';
import type { AIProvider } from '@connpass-discord-bot/core';

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
