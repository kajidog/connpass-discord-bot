/**
 * HTMLをDiscordマークダウンに変換
 */
export function htmlToDiscord(html: string): string {
  let text = html;

  // <br>タグを改行に
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // <p>タグを改行に
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<p[^>]*>/gi, '');

  // <h1>-<h6>を太字に
  text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '**$1**\n');

  // <strong>/<b>を太字に
  text = text.replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, '**$2**');

  // <em>/<i>を斜体に
  text = text.replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, '*$2*');

  // <a>をマークダウンリンクに
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // <ul>/<ol>/<li>をリストに
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n');
  text = text.replace(/<\/?[uo]l[^>]*>/gi, '\n');

  // <code>をコードに
  text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

  // <pre>をコードブロックに
  text = text.replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```');

  // <blockquote>を引用に
  text = text.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, content) => {
    return content
      .split('\n')
      .map((line: string) => `> ${line}`)
      .join('\n');
  });

  // その他のHTMLタグを削除
  text = text.replace(/<[^>]+>/g, '');

  // HTMLエンティティをデコード
  text = decodeHtmlEntities(text);

  // 連続する改行を最大2つに
  text = text.replace(/\n{3,}/g, '\n\n');

  // 前後の空白をトリム
  text = text.trim();

  return text;
}

/**
 * HTMLエンティティをデコード
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&ndash;': '\u2013',
    '&mdash;': '\u2014',
    '&lsquo;': '\u2018',
    '&rsquo;': '\u2019',
    '&ldquo;': '\u201C',
    '&rdquo;': '\u201D',
    '&hellip;': '\u2026',
    '&copy;': '\u00A9',
    '&reg;': '\u00AE',
    '&trade;': '\u2122',
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }

  // 数値エンティティ
  decoded = decoded.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, code) =>
    String.fromCharCode(parseInt(code, 16))
  );

  return decoded;
}
