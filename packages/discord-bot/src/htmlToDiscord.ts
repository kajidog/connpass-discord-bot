// Minimal HTML → Discord-friendly markdown/text converter
// - Handles headings, paragraphs, line breaks, lists, code, links, tables (simple)
// - Strips unknown tags and decodes common entities

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

function convertLinks(html: string): string {
  // <a href="URL">text</a> → text (URL)
  return html.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, text) => {
    const label = stripTags(text).trim();
    const url = href.trim();
    if (!label) return url;
    return `${label} (${url})`;
  });
}

function convertCode(html: string): string {
  // <pre><code>...</code></pre> or <pre>...</pre> → ```\n...\n```
  let s = html.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_m, code) => {
    return '```\n' + decodeEntities(stripTags(code)) + '\n```';
  });
  s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_m, pre) => {
    return '```\n' + decodeEntities(stripTags(pre)) + '\n```';
  });
  // inline <code> → `...`
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_m, code) => '`' + decodeEntities(stripTags(code)) + '`');
  return s;
}

function convertHeadings(html: string): string {
  // <h1-4> → blank line + **text** + newline
  return html.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, _lvl, inner) => {
    const text = stripTags(inner).trim();
    return `\n\n**${text}**\n`;
  });
}

function convertBreaks(html: string): string {
  return html
    .replace(/<br\s*\/?>(\r?\n)?/gi, '\n')
    .replace(/<p[^>]*>\s*/gi, '')
    .replace(/\s*<\/p>/gi, '\n\n');
}

function convertLists(html: string): string {
  // Turn list items into bullets
  let s = html;
  // Ordered lists: we will just use bullets for simplicity
  s = s.replace(/<li[^>]*>\s*([\s\S]*?)\s*<\/li>/gi, (_m, inner) => {
    const text = stripTags(inner).trim();
    if (!text) return '';
    return `\n- ${text}`;
  });
  // remove enclosing <ul>/<ol>
  s = s.replace(/<\/?ul[^>]*>/gi, '')
       .replace(/<\/?ol[^>]*>/gi, '');
  return s;
}

function convertTables(html: string): string {
  // Simple conversion: each row => "- col1: col2 | col3 ..."
  return html.replace(/<table[^>]*>[\s\S]*?<\/table>/gi, (table) => {
    const rows: string[] = [];
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(table)) !== null) {
      const rowHtml = m[1];
      const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      const cells: string[] = [];
      let cm: RegExpExecArray | null;
      while ((cm = cellRe.exec(rowHtml)) !== null) {
        const v = stripTags(cm[1]).replace(/\s+/g, ' ').trim();
        if (v) cells.push(v);
      }
      if (cells.length) {
        if (cells.length === 2) rows.push(`- ${cells[0]}: ${cells[1]}`);
        else rows.push('- ' + cells.join(' | '));
      }
    }
    return '\n' + rows.join('\n') + '\n';
  });
}

function cleanup(text: string): string {
  let s = text;
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.split('\n').map((line) => line.replace(/[\t\u00A0\u200B]+/g, ' ').replace(/\s{2,}/g, ' ').trimEnd()).join('\n');
  s = s.replace(/\n\s+\n/g, '\n\n');
  return s.trim();
}

export function htmlToDiscord(text: string): string {
  if (!text) return '';
  let s = text;
  s = convertLinks(s);
  s = convertCode(s);
  s = convertHeadings(s);
  s = convertBreaks(s);
  s = convertLists(s);
  s = convertTables(s);
  // finally drop any remaining tags and decode
  s = decodeEntities(stripTags(s));
  s = cleanup(s);
  return s;
}

export function truncateForEmbed(text: string, max = 4000): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

