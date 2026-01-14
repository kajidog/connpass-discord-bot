import type { ChatInputCommandInteraction } from 'discord.js';
import type {
  IUserStore,
  IUserNotifySettingsStore,
} from '@connpass-discord-bot/core';

/**
 * デフォルトの通知分前設定
 */
const DEFAULT_MINUTES_BEFORE = parseInt(
  process.env.DEFAULT_NOTIFY_MINUTES_BEFORE || '15',
  10
);

/**
 * /connpass notify on ハンドラー
 */
export async function handleNotifyOn(
  interaction: ChatInputCommandInteraction,
  userStore: IUserStore,
  notifySettingsStore: IUserNotifySettingsStore
): Promise<void> {
  const discordUserId = interaction.user.id;

  // ユーザー登録チェック
  const user = await userStore.find(discordUserId);
  if (!user) {
    await interaction.reply({
      content:
        'Connpassニックネームが登録されていません。\n先に `/connpass user register` で登録してください。',
      ephemeral: true,
    });
    return;
  }

  const minutesBefore =
    interaction.options.getInteger('minutes_before') ?? DEFAULT_MINUTES_BEFORE;

  await notifySettingsStore.save({
    discordUserId,
    enabled: true,
    minutesBefore,
    updatedAt: new Date().toISOString(),
  });

  await interaction.reply({
    content: `イベント通知を **ON** にしました。\nイベント開始 **${minutesBefore}分前** にDMで通知します。\n\n注意: DMを受け取るにはサーバーのメンバーからのダイレクトメッセージを許可してください。`,
    ephemeral: true,
  });
}

/**
 * /connpass notify off ハンドラー
 */
export async function handleNotifyOff(
  interaction: ChatInputCommandInteraction,
  notifySettingsStore: IUserNotifySettingsStore
): Promise<void> {
  const discordUserId = interaction.user.id;

  const settings = await notifySettingsStore.find(discordUserId);
  if (settings) {
    await notifySettingsStore.save({
      ...settings,
      enabled: false,
      updatedAt: new Date().toISOString(),
    });
  }

  await interaction.reply({
    content: 'イベント通知を **OFF** にしました。',
    ephemeral: true,
  });
}

/**
 * /connpass notify status ハンドラー
 */
export async function handleNotifyStatus(
  interaction: ChatInputCommandInteraction,
  userStore: IUserStore,
  notifySettingsStore: IUserNotifySettingsStore
): Promise<void> {
  const discordUserId = interaction.user.id;

  const user = await userStore.find(discordUserId);
  const settings = await notifySettingsStore.find(discordUserId);

  let status = '**通知設定状況**\n\n';

  if (!user) {
    status += 'Connpassニックネーム: 未登録\n';
    status += 'イベント通知: 利用不可（先にユーザー登録が必要）';
  } else {
    status += `Connpassニックネーム: **${user.connpassNickname}**\n`;
    if (!settings || !settings.enabled) {
      status += 'イベント通知: **OFF**\n';
      status += '\n`/connpass notify on` で通知を有効化できます。';
    } else {
      status += `イベント通知: **ON** (開始 ${settings.minutesBefore}分前に通知)\n`;
      status += '\n`/connpass notify off` で通知を無効化できます。';
    }
  }

  await interaction.reply({
    content: status,
    ephemeral: true,
  });
}
