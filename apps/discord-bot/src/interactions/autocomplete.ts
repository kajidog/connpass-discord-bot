import type { AutocompleteInteraction } from 'discord.js';
import { filterPrefectures } from '../data/prefectures.js';

/**
 * オートコンプリートハンドラー
 */
export async function handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);

  if (focused.name === 'location') {
    const query = focused.value;
    const filtered = filterPrefectures(query);
    await interaction.respond(filtered);
  }
}
