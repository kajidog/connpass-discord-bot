/**
 * コマンドサジェスト定義
 */

export const COMMAND_SUGGESTIONS = [
  '/connpass feed status',
  '/connpass feed set schedule:',
  '/connpass feed set keywords_and:',
  '/connpass feed set keywords_or:',
  '/connpass feed set range_days:',
  '/connpass feed set location:',
  '/connpass feed set use_ai:',
  '/connpass feed remove',
  '/connpass feed logs',
  '/connpass feed share',
  '/connpass feed apply channels:',
] as const;

export type CommandSuggestion = (typeof COMMAND_SUGGESTIONS)[number];

/**
 * 都道府県リスト
 */
export const PREFECTURES = [
  '北海道',
  '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
  'オンライン',
] as const;

/**
 * 入力に基づいてサジェストをフィルタリング
 */
export function filterSuggestions(input: string): string[] {
  if (!input.trim()) {
    return [...COMMAND_SUGGESTIONS].slice(0, 5);
  }

  const lowerInput = input.toLowerCase();

  // location: の後に都道府県サジェストを表示
  const locationMatch = input.match(/^\/connpass feed set location:(.*)$/i);
  if (locationMatch) {
    const locationInput = locationMatch[1].trim();
    if (locationInput === '') {
      return PREFECTURES.slice(0, 8).map((p) => `/connpass feed set location:${p}`);
    }
    return PREFECTURES.filter((p) =>
      p.toLowerCase().includes(locationInput.toLowerCase())
    )
      .slice(0, 8)
      .map((p) => `/connpass feed set location:${p}`);
  }

  return COMMAND_SUGGESTIONS.filter((cmd) =>
    cmd.toLowerCase().startsWith(lowerInput)
  );
}

/**
 * コマンドの説明を取得
 */
export function getCommandDescription(command: string): string {
  // location:で始まる場合は都道府県名なので説明不要
  if (command.includes('location:') && !command.endsWith('location:')) {
    return '';
  }

  const descriptions: Record<string, string> = {
    '/connpass feed status': '現在の設定を表示',
    '/connpass feed set schedule:': 'スケジュール設定 (cron形式)',
    '/connpass feed set keywords_and:': 'AND検索キーワード設定',
    '/connpass feed set keywords_or:': 'OR検索キーワード設定',
    '/connpass feed set range_days:': '検索範囲日数設定',
    '/connpass feed set location:': '開催場所フィルタ設定',
    '/connpass feed set use_ai:': 'AI要約の有効/無効',
    '/connpass feed remove': 'Feed設定を削除',
    '/connpass feed logs': 'Feed実行ログを表示',
    '/connpass feed share': '設定をCLIコマンド形式で表示',
    '/connpass feed apply channels:': '複数チャンネルに設定を適用',
  };

  return descriptions[command] || '';
}
