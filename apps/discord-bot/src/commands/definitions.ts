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
          .addIntegerOption((o) =>
            o
              .setName('min_participants')
              .setDescription('参加人数がこの人数以上のイベントを通知')
              .setMinValue(1)
          )
          .addIntegerOption((o) =>
            o
              .setName('min_limit')
              .setDescription('募集人数がこの人数以上のイベントを通知')
              .setMinValue(1)
          )
          .addBooleanOption((o) =>
            o.setName('use_ai').setDescription('AI機能を使用（後日実装予定）')
          )
      )
      .addSubcommand((sub) => sub.setName('status').setDescription('現在のフィード設定を表示'))
      .addSubcommand((sub) => sub.setName('remove').setDescription('このチャンネルのフィードを削除'))
      .addSubcommand((sub) => sub.setName('run').setDescription('フィードを即時実行'))
      .addSubcommand((sub) => sub.setName('share').setDescription('現在のフィード設定をCLIコマンド形式で表示'))
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

  // /connpass model サブコマンドグループ
  .addSubcommandGroup((group) =>
    group
      .setName('model')
      .setDescription('このチャンネルのAIモデル設定を管理')
      .addSubcommand((sub) =>
        sub
          .setName('set')
          .setDescription('使用するモデルを設定')
          .addStringOption((o) =>
            o
              .setName('type')
              .setDescription('モデルの種類')
              .setRequired(true)
              .addChoices(
                { name: 'エージェント（会話）', value: 'agent' },
                { name: '要約', value: 'summarizer' }
              )
          )
          .addStringOption((o) =>
            o
              .setName('provider')
              .setDescription('AIプロバイダー')
              .setRequired(true)
              .addChoices(
                { name: 'OpenAI', value: 'openai' },
                { name: 'Anthropic (Claude)', value: 'anthropic' },
                { name: 'Google (Gemini)', value: 'google' }
              )
          )
          .addStringOption((o) =>
            o
              .setName('model')
              .setDescription('モデル名（例: gpt-4o-mini）')
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand((sub) => sub.setName('status').setDescription('現在のモデル設定を表示'))
      .addSubcommand((sub) => sub.setName('list').setDescription('使用可能なモデル一覧を表示'))
      .addSubcommand((sub) =>
        sub
          .setName('reset')
          .setDescription('このチャンネルのモデル設定をリセット（グローバル設定を使用）')
          .addStringOption((o) =>
            o
              .setName('type')
              .setDescription('リセットするモデルの種類（未指定の場合は全てリセット）')
              .addChoices(
                { name: 'エージェント（会話）', value: 'agent' },
                { name: '要約', value: 'summarizer' }
              )
          )
      )
  )

  // /connpass admin サブコマンドグループ
  .addSubcommandGroup((group) =>
    group
      .setName('admin')
      .setDescription('管理者とBANの管理')
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('管理者を追加')
          .addUserOption((o) => o.setName('user').setDescription('追加するユーザー').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('管理者を削除')
          .addUserOption((o) => o.setName('user').setDescription('削除する管理者').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName('ban')
          .setDescription('ユーザーをBAN')
          .addUserOption((o) => o.setName('user').setDescription('BANするユーザー').setRequired(true))
          .addStringOption((o) => o.setName('reason').setDescription('理由（任意）'))
      )
      .addSubcommand((sub) =>
        sub
          .setName('unban')
          .setDescription('BANを解除')
          .addUserOption((o) => o.setName('user').setDescription('解除するユーザー').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName('list')
          .setDescription('管理者/バン一覧を表示')
          .addStringOption((o) =>
            o
              .setName('type')
              .setDescription('表示対象')
              .addChoices(
                { name: '管理者', value: 'admins' },
                { name: 'バン', value: 'bans' },
                { name: 'すべて', value: 'all' }
              )
          )
      )
  )

  // /connpass notify サブコマンドグループ
  .addSubcommandGroup((group) =>
    group
      .setName('notify')
      .setDescription('イベント通知設定を管理')
      .addSubcommand((sub) =>
        sub
          .setName('on')
          .setDescription('イベント通知をONにする')
          .addIntegerOption((o) =>
            o
              .setName('minutes_before')
              .setDescription('イベント開始何分前に通知するか（デフォルト: 15分）')
              .setMinValue(5)
              .setMaxValue(60)
          )
      )
      .addSubcommand((sub) =>
        sub.setName('off').setDescription('イベント通知をOFFにする')
      )
      .addSubcommand((sub) =>
        sub.setName('status').setDescription('現在の通知設定を表示')
      )
  )

  // /connpass today
  .addSubcommand((sub) => sub.setName('today').setDescription('今日参加予定のイベントを表示'))

  // /connpass help
  .addSubcommand((sub) => sub.setName('help').setDescription('使い方を表示'));

export const commands = [connpassCommand.toJSON()];
