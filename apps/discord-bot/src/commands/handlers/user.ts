import type { ChatInputCommandInteraction } from 'discord.js';
import type { IUserStore, User } from '@connpass-discord-bot/core';

/**
 * /connpass user register ハンドラー
 */
export async function handleUserRegister(
  interaction: ChatInputCommandInteraction,
  store: IUserStore
): Promise<void> {
  const discordUserId = interaction.user.id;
  const nickname = interaction.options.getString('nickname', true).trim();

  if (!nickname) {
    await interaction.reply({
      content: 'ニックネームを入力してください。',
      ephemeral: true,
    });
    return;
  }

  const user: User = {
    discordUserId,
    connpassNickname: nickname,
    registeredAt: new Date().toISOString(),
  };

  await store.save(user);

  await interaction.reply({
    content: `Connpassニックネーム **${nickname}** を登録しました。\n\n今後、\`/connpass today\` や重複チェック機能でこのニックネームが使用されます。`,
    ephemeral: true,
  });
}

/**
 * /connpass user show ハンドラー
 */
export async function handleUserShow(
  interaction: ChatInputCommandInteraction,
  store: IUserStore
): Promise<void> {
  const discordUserId = interaction.user.id;
  const user = await store.find(discordUserId);

  if (!user) {
    await interaction.reply({
      content: 'Connpassニックネームが登録されていません。\n`/connpass user register` で登録してください。',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: `登録済みConnpassニックネーム: **${user.connpassNickname}**\n登録日時: ${new Date(user.registeredAt).toLocaleString('ja-JP')}`,
    ephemeral: true,
  });
}

/**
 * /connpass user unregister ハンドラー
 */
export async function handleUserUnregister(
  interaction: ChatInputCommandInteraction,
  store: IUserStore
): Promise<void> {
  const discordUserId = interaction.user.id;
  const user = await store.find(discordUserId);

  if (!user) {
    await interaction.reply({
      content: 'Connpassニックネームが登録されていません。',
      ephemeral: true,
    });
    return;
  }

  await store.delete(discordUserId);

  await interaction.reply({
    content: `Connpassニックネーム **${user.connpassNickname}** の登録を解除しました。`,
    ephemeral: true,
  });
}
