import type { ChatInputCommandInteraction } from 'discord.js';
import type { IChannelModelStore, AIProvider, ModelConfig, ChannelModelConfig, IBanStore } from '@connpass-discord-bot/core';
import { getAIConfig, validateModel } from '../../ai/index.js';
import { isBannedUser } from '../../security/permissions.js';

/**
 * モデル設定の参照先チャンネルIDを取得
 * スレッド内コマンドでは親チャンネルの設定を使用する
 */
function getChannelIdForModelConfig(interaction: ChatInputCommandInteraction): string {
  const channel = interaction.channel;
  if (channel?.isThread()) {
    return channel.parentId ?? interaction.channelId;
  }
  return interaction.channelId;
}

/**
 * /connpass model ハンドラー
 */
export async function handleModelCommand(
  interaction: ChatInputCommandInteraction,
  channelModelStore: IChannelModelStore,
  banStore: IBanStore
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'set':
      await handleModelSet(interaction, channelModelStore, banStore);
      break;
    case 'status':
      await handleModelStatus(interaction, channelModelStore);
      break;
    case 'reset':
      await handleModelReset(interaction, channelModelStore, banStore);
      break;
    case 'list':
      await handleModelList(interaction);
      break;
    default:
      await interaction.reply({ content: '未知のサブコマンドです', ephemeral: true });
  }
}

/**
 * /connpass model set
 */
async function handleModelSet(
  interaction: ChatInputCommandInteraction,
  channelModelStore: IChannelModelStore,
  banStore: IBanStore
): Promise<void> {
  if (await isBannedUser(banStore, interaction.user.id)) {
    await interaction.reply({
      content: '⛔ あなたはBANされているため、モデル変更はできません。',
      ephemeral: true,
    });
    return;
  }
  const type = interaction.options.getString('type', true) as 'agent' | 'summarizer';
  const provider = interaction.options.getString('provider', true) as AIProvider;
  const model = interaction.options.getString('model', true);
  const channelId = getChannelIdForModelConfig(interaction);

  // グローバル設定を取得
  const aiConfig = getAIConfig();

  // 許可リストでバリデーション
  if (!validateModel(aiConfig, provider, model)) {
    const allowedModels = aiConfig.allowedModels[provider] || [];
    await interaction.reply({
      content: `❌ モデル \`${model}\` は許可リストにありません。\n\n**${provider}の許可モデル:**\n${allowedModels.map(m => `- \`${m}\``).join('\n')}`,
      ephemeral: true,
    });
    return;
  }

  // 既存の設定を取得
  let channelConfig = await channelModelStore.get(channelId);
  if (!channelConfig) {
    channelConfig = { channelId };
  }

  // 設定を更新
  const modelConfig: ModelConfig = { provider, model };
  if (type === 'agent') {
    channelConfig.agent = modelConfig;
  } else {
    channelConfig.summarizer = modelConfig;
  }

  await channelModelStore.save(channelConfig);

  const typeName = type === 'agent' ? 'エージェント（会話）' : '要約';
  await interaction.reply({
    content: `✅ **${typeName}モデルを設定しました**\n\nプロバイダー: ${provider}\nモデル: \`${model}\``,
    ephemeral: true,
  });
}

/**
 * /connpass model status
 */
async function handleModelStatus(
  interaction: ChatInputCommandInteraction,
  channelModelStore: IChannelModelStore
): Promise<void> {
  const channelId = getChannelIdForModelConfig(interaction);
  const aiConfig = getAIConfig();
  const channelConfig = await channelModelStore.get(channelId);

  let message = '📊 **このチャンネルのAIモデル設定**\n\n';

  // エージェント設定
  const agentConfig = channelConfig?.agent || aiConfig.agent;
  const agentSource = channelConfig?.agent ? '🔧 カスタム' : '🌐 デフォルト';
  message += `**🤖 エージェント（会話）**\n`;
  message += `├ 設定: ${agentSource}\n`;
  message += `└ モデル: \`${agentConfig.provider}/${agentConfig.model}\`\n\n`;

  // 要約設定
  const summarizerConfig = channelConfig?.summarizer || aiConfig.summarizer;
  const summarizerSource = channelConfig?.summarizer ? '🔧 カスタム' : '🌐 デフォルト';
  message += `**📝 要約**\n`;
  message += `├ 設定: ${summarizerSource}\n`;
  message += `└ モデル: \`${summarizerConfig.provider}/${summarizerConfig.model}\`\n\n`;

  message += `💡 \`/connpass model list\` で使用可能なモデル一覧を表示`;

  await interaction.reply({ content: message, ephemeral: true });
}

/**
 * /connpass model list
 */
async function handleModelList(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const aiConfig = getAIConfig();

  let message = '📋 **使用可能なモデル一覧**\n\n';

  for (const [provider, models] of Object.entries(aiConfig.allowedModels)) {
    message += `**${provider}**\n`;
    message += models.map(m => `└ \`${m}\``).join('\n');
    message += '\n\n';
  }

  message += `💡 \`/connpass model set\` でモデルを設定`;

  await interaction.reply({ content: message, ephemeral: true });
}

/**
 * /connpass model reset
 */
async function handleModelReset(
  interaction: ChatInputCommandInteraction,
  channelModelStore: IChannelModelStore,
  banStore: IBanStore
): Promise<void> {
  if (await isBannedUser(banStore, interaction.user.id)) {
    await interaction.reply({
      content: '⛔ あなたはBANされているため、モデル変更はできません。',
      ephemeral: true,
    });
    return;
  }
  const channelId = getChannelIdForModelConfig(interaction);
  const type = interaction.options.getString('type') as 'agent' | 'summarizer' | null;

  if (!type) {
    // 全てリセット
    await channelModelStore.delete(channelId);
    await interaction.reply({
      content: '✅ このチャンネルのモデル設定を全てリセットしました。グローバル設定を使用します。',
      ephemeral: true,
    });
    return;
  }

  // 特定のタイプのみリセット
  const channelConfig = await channelModelStore.get(channelId);
  if (!channelConfig) {
    await interaction.reply({
      content: '⚠️ このチャンネルには設定がありません。',
      ephemeral: true,
    });
    return;
  }

  const typeName = type === 'agent' ? 'エージェント（会話）' : '要約';

  if (type === 'agent') {
    delete channelConfig.agent;
  } else {
    delete channelConfig.summarizer;
  }

  // 両方の設定が削除された場合はチャンネル設定自体を削除
  if (!channelConfig.agent && !channelConfig.summarizer) {
    await channelModelStore.delete(channelId);
  } else {
    await channelModelStore.save(channelConfig);
  }

  await interaction.reply({
    content: `✅ **${typeName}モデル**をリセットしました。グローバル設定を使用します。`,
    ephemeral: true,
  });
}
