import { SlashCommandBuilder } from 'discord.js';

/**
 * /connpass コマンド定義
 */
export const connpassCommand = new SlashCommandBuilder()
  .setName('connpass')
  .setDescription('Connpassイベントボットのコマンド')

  // /connpass feed サブコマンドグループ
  .addSubcommandGroup((group) =>
    group
      .setName('feed')
      .setDescription('このチャンネルのイベントフィードを管理')
      .addSubcommand((sub) =>
        sub
          .setName('set')
          .setDescription('フィード設定を追加/更新')
          .addStringOption((o) =>
            o
              .setName('schedule')
              .setDescription('配信スケジュール')
              .setRequired(true)
              .addChoices(
                { name: '毎日 9:00', value: '0 9 * * *' },
                { name: '毎日 12:00', value: '0 12 * * *' },
                { name: '毎日 18:00', value: '0 18 * * *' },
                { name: '平日 9:00', value: '0 9 * * 1-5' },
                { name: '毎週月曜 9:00', value: '0 9 * * 1' },
                { name: '毎週金曜 18:00', value: '0 18 * * 5' },
                { name: 'カスタム（cron式を指定）', value: 'custom' }
              )
          )
          .addStringOption((o) =>
            o
              .setName('custom_schedule')
              .setDescription('カスタムcron式（例: "0 9 * * 1" = 毎週月曜9時）※scheduleで「カスタム」選択時のみ')
          )
          .addStringOption((o) =>
            o.setName('keywords_and').setDescription('AND検索キーワード（カンマ/スペース区切り）')
          )
          .addStringOption((o) =>
            o.setName('keywords_or').setDescription('OR検索キーワード（カンマ/スペース区切り）')
          )
          .addIntegerOption((o) =>
            o
              .setName('range_days')
              .setDescription('検索範囲日数（デフォルト: 14）')
              .setMinValue(1)
              .setMaxValue(120)
          )
          .addStringOption((o) =>
            o.setName('location').setDescription('都道府県フィルタ').setAutocomplete(true)
          )
          .addStringOption((o) => o.setName('hashtag').setDescription('ハッシュタグフィルタ（#不要）'))
          .addStringOption((o) =>
            o.setName('owner_nickname').setDescription('主催者ニックネーム')
          )
          .addStringOption((o) =>
            o
              .setName('order')
              .setDescription('ソート順')
              .addChoices(
                { name: '更新日時（新しい順）', value: 'updated_desc' },
                { name: '開始日時（早い順）', value: 'started_asc' },
                { name: '開始日時（遅い順）', value: 'started_desc' }
              )
          )
          .addBooleanOption((o) =>
            o.setName('use_ai').setDescription('AI機能を使用（後日実装予定）')
          )
      )
      .addSubcommand((sub) => sub.setName('status').setDescription('現在のフィード設定を表示'))
      .addSubcommand((sub) => sub.setName('remove').setDescription('このチャンネルのフィードを削除'))
      .addSubcommand((sub) => sub.setName('run').setDescription('フィードを即時実行'))
  )

  // /connpass user サブコマンドグループ
  .addSubcommandGroup((group) =>
    group
      .setName('user')
      .setDescription('Connpassユーザー設定を管理')
      .addSubcommand((sub) =>
        sub
          .setName('register')
          .setDescription('Connpassニックネームを登録')
          .addStringOption((o) =>
            o.setName('nickname').setDescription('あなたのConnpassニックネーム').setRequired(true)
          )
      )
      .addSubcommand((sub) => sub.setName('show').setDescription('登録済みニックネームを表示'))
      .addSubcommand((sub) => sub.setName('unregister').setDescription('ニックネーム登録を解除'))
  )

  // /connpass today
  .addSubcommand((sub) => sub.setName('today').setDescription('今日参加予定のイベントを表示'))

  // /connpass help
  .addSubcommand((sub) => sub.setName('help').setDescription('使い方を表示'));

export const commands = [connpassCommand.toJSON()];
