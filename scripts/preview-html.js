// Quick preview script to convert memo.txt HTML into Discord-friendly text
// Usage: node scripts/preview-html.js memo.txt
const fs = require('fs');

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
function stripTags(s) { return s.replace(/<[^>]+>/g, ''); }
function convertLinks(html) {
  return html.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, text) => {
    const label = stripTags(text).trim();
    const url = href.trim();
    if (!label) return url; return `${label} (${url})`;
  });
}
function convertCode(html) {
  let s = html.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_m, code) => '```\n' + decodeEntities(stripTags(code)) + '\n```');
  s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_m, pre) => '```\n' + decodeEntities(stripTags(pre)) + '\n```');
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_m, code) => '`' + decodeEntities(stripTags(code)) + '`');
  return s;
}
function convertHeadings(html) { return html.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, _lvl, inner) => `\n\n**${stripTags(inner).trim()}**\n`); }
function convertBreaks(html) { return html.replace(/<br\s*\/?>(\r?\n)?/gi, '\n').replace(/<p[^>]*>\s*/gi, '').replace(/\s*<\/p>/gi, '\n\n'); }
function convertLists(html) {
  let s = html;
  s = s.replace(/<li[^>]*>\s*([\s\S]*?)\s*<\/li>/gi, (_m, inner) => { const t = stripTags(inner).trim(); return t ? `\n- ${t}` : ''; });
  s = s.replace(/<\/?ul[^>]*>/gi, '').replace(/<\/?ol[^>]*>/gi, '');
  return s;
}
function convertTables(html) {
  return html.replace(/<table[^>]*>[\s\S]*?<\/table>/gi, (table) => {
    const rows = [];
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi; let m;
    while ((m = rowRe.exec(table)) !== null) {
      const rowHtml = m[1]; const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi; const cells = []; let cm;
      while ((cm = cellRe.exec(rowHtml)) !== null) { const v = stripTags(cm[1]).replace(/\s+/g, ' ').trim(); if (v) cells.push(v); }
      if (cells.length) { rows.push(cells.length === 2 ? `- ${cells[0]}: ${cells[1]}` : '- ' + cells.join(' | ')); }
    }
    return '\n' + rows.join('\n') + '\n';
  });
}
function cleanup(text) {
  let s = text;
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.split('\n').map((line) => line.replace(/[\t\u00A0\u200B]+/g, ' ').replace(/\s{2,}/g, ' ').trimEnd()).join('\n');
  s = s.replace(/\n\s+\n/g, '\n\n');
  return s.trim();
}
function htmlToDiscord(text) {
  if (!text) return '';
  let s = text;
  s = convertLinks(s);
  s = convertCode(s);
  s = convertHeadings(s);
  s = convertBreaks(s);
  s = convertLists(s);
  s = convertTables(s);
  s = decodeEntities(stripTags(s));
  s = cleanup(s);
  return s;
}

const file = process.argv[2] || 'memo.txt';
const raw = fs.readFileSync(file, 'utf8');
// Split header and HTML body if present in memo format
const parts = raw.split(/\n\n+/);
let html = raw;
for (let i = 0; i < parts.length; i += 1) {
  if (parts[i].includes('<') && parts[i].includes('>')) { html = parts.slice(i).join('\n\n'); break; }
}
const out = htmlToDiscord(html);
console.log(out);

