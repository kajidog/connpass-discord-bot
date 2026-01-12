import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder } from 'discord.js';

/**
 * /connpass help ハンドラー
 */
export async function handleHelp(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle('Connpass Bot 使い方')
    .setColor(0x00a3ff)
    .setDescription('Connpassのイベント情報を通知するBotです。')
    .addFields(
      {
        name: '/connpass feed set',
        value: [
          '**このチャンネルの監視条件を追加/更新**',
          '`schedule` - cron式スケジュール（例: `0 9 * * 1` = 毎週月曜9時）',
          '`keywords_and` - AND検索キーワード（カンマ/スペース区切り）',
          '`keywords_or` - OR検索キーワード（カンマ/スペース区切り）',
          '`range_days` - 検索範囲日数（デフォルト: 14）',
          '`location` - 都道府県フィルタ（オートコンプリート対応）',
          '`hashtag` - ハッシュタグ（先頭#不要）',
          '`owner_nickname` - 主催者ニックネーム',
          '`order` - ソート順',
        ].join('\n'),
      },
      {
        name: '/connpass feed status',
        value: '現在のフィード設定を表示',
      },
      {
        name: '/connpass feed remove',
        value: 'このチャンネルのフィードを削除',
      },
      {
        name: '/connpass feed run',
        value: 'フィードを即時実行',
      },
      {
        name: '/connpass user register',
        value: [
          '**あなたのConnpassニックネームを登録**',
          '`nickname` - Connpassのニックネーム',
          '',
          '登録すると `/connpass today` や重複チェック機能が使用できます。',
        ].join('\n'),
      },
      {
        name: '/connpass user show',
        value: '登録済みのニックネームを表示',
      },
      {
        name: '/connpass user unregister',
        value: 'ニックネームの登録を解除',
      },
      {
        name: '/connpass today',
        value: '登録したニックネームで今日参加予定のイベントを表示',
      },
      {
        name: 'イベント埋め込みのボタン',
        value: [
          '**詳細** - イベントの詳細をスレッドに投稿',
          '**登壇** - 登壇情報をスレッドに投稿',
          '**重複チェック** - 参加予定イベントとの時間重複を確認',
          '**Web** - イベントページを開く',
          '**地図** - Google Mapsを開く（位置情報がある場合）',
        ].join('\n'),
      }
    )
    .setFooter({ text: 'cron式の例: 0 9 * * * = 毎日9時 / 0 9 * * 1 = 毎週月曜9時' });

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}
