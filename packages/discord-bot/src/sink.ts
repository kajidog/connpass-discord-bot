import { JobSink, NewEventsPayload } from '@connpass-discord-bot/job';
import type { Client, TextBasedChannel } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

function fmtDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  // Always render in Japan time for Discord feed
  const opts: Intl.DateTimeFormatOptions = {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Asia/Tokyo',
  };
  // e.g. 2025/09/15 19:00
  return new Intl.DateTimeFormat('ja-JP', opts).format(d).replace(',', '');
}

function fmtPeriod(start?: string, end?: string): string {
  const s = fmtDate(start);
  const e = fmtDate(end);
  if (s && e && s !== e) return `${s} 〜 ${e}`;
  return s || e || '';
}

export class DiscordSink implements JobSink {
  constructor(private readonly client: Client) {}

  async handleNewEvents(payload: NewEventsPayload): Promise<void> {
    const fetched = await this.client.channels.fetch(payload.channelId).catch(() => null);
    if (!fetched || !('isTextBased' in fetched) || !fetched.isTextBased()) return;
    const channel = fetched as TextBasedChannel;
    const canSend = (c: any): c is { send: (options: any) => Promise<any> } => typeof c?.send === 'function';
    if (!canSend(channel)) return;

    // Send one rich embed per event with key fields
    for (const e of payload.events) {
      const when = fmtPeriod(e.startedAt, e.endedAt);
      const place = e.place || '';
      const address = e.address || '';
      const venue = [place, address].filter(Boolean).join(' ');
      const participants = e.limit ? `${e.participantCount}/${e.limit}` : `${e.participantCount}`;
      const description = [e.catchPhrase]
        .filter(Boolean)
        .join('\n');

      const embed = {
        title: e.title,
        url: e.url,
        description: description || undefined,
        color: 0x00a3ff,
        fields: [
          when ? { name: '開催日時', value: when, inline: false } : undefined,
          venue ? { name: '会場', value: venue, inline: false } : undefined,
          { name: '参加', value: participants, inline: true },
          e.hashTag ? { name: 'ハッシュタグ', value: `#${e.hashTag}`, inline: true } : undefined,
          e.groupTitle || e.groupUrl
            ? { name: 'グループ', value: e.groupUrl ? `[${e.groupTitle ?? e.groupUrl}](${e.groupUrl})` : `${e.groupTitle}`, inline: false }
            : undefined,
        ].filter(Boolean),
        timestamp: e.updatedAt,
        footer: { text: '最終更新' },
      } as const;

      const baseButtons = [
        new ButtonBuilder().setCustomId(`ev:detail:${e.id}`).setLabel('詳細').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`ev:pres:${e.id}`).setLabel('登壇').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`ev:conflict:${e.id}`).setLabel('重複チェック').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setLabel('Web').setStyle(ButtonStyle.Link).setURL(e.url),
      ];

      const mapQuery = [place, address].filter(Boolean).join(' ');
      const mapUrl = e.lat != null && e.lon != null
        ? `https://www.google.com/maps?q=${e.lat},${e.lon}`
        : (mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}` : null);

      const rows = [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          ...(mapUrl ? [...baseButtons, new ButtonBuilder().setLabel('地図').setStyle(ButtonStyle.Link).setURL(mapUrl)] : baseButtons),
        ),
      ];

      // send sequentially to preserve order
      // eslint-disable-next-line no-await-in-loop
      await channel.send({ embeds: [embed], components: rows });
    }
  }

  async handleReport(payload: any): Promise<void> {
    const fetched = await this.client.channels.fetch(payload.channelId).catch(() => null);
    if (!fetched || !('isTextBased' in fetched) || !fetched.isTextBased()) return;
    const channel = fetched as TextBasedChannel;
    const canSend = (c: any): c is { send: (options: any) => Promise<any> } => typeof c?.send === 'function';
    if (!canSend(channel)) return;

    // Utilities replicated from commands
    const splitForDiscord = (text: string, maxLen = 1900): string[] => {
      const chunks: string[] = [];
      const push = (s: string) => { if (s.trim().length) chunks.push(s.trimEnd()); };
      if (text.length <= maxLen) return [text];
      const paragraphs = text.split(/\n\n+/);
      let buf = '';
      for (const p of paragraphs) {
        const para = p + '\n\n';
        if (para.length > maxLen) {
          const lines = p.split(/\n/);
          for (const line of lines) {
            const l = line + '\n';
            if ((buf + l).length > maxLen) { push(buf); buf = ''; }
            if (l.length > maxLen) {
              let rest = l;
              while (rest.length > 0) {
                let cut = Math.min(maxLen - (buf.length || 0), rest.length);
                const head = rest.slice(0, cut);
                let idx = Math.max(head.lastIndexOf('。'), head.lastIndexOf('\n'));
                if (idx < 0) idx = Math.max(head.lastIndexOf('、'), head.lastIndexOf(' '));
                if (idx > 20) cut = idx + 1;
                const piece = rest.slice(0, cut);
                if ((buf + piece).length > maxLen) { push(buf); buf = ''; }
                buf += piece;
                push(buf);
                buf = '';
                rest = rest.slice(cut);
              }
            } else {
              buf += l;
            }
          }
        } else {
          if ((buf + para).length > maxLen) { push(buf); buf = ''; }
          buf += para;
        }
      }
      push(buf);
      return chunks;
    };

    const callMastraAgent = async (agentId: string, baseUrl: string, userText: string, systemText?: string): Promise<string> => {
      const url = `${baseUrl.replace(/\/$/, '')}/api/agents/${encodeURIComponent(agentId)}/generate`;
      const body = {
        messages: [
          ...(systemText ? [{ role: 'system', content: systemText }] : []),
          { role: 'user', content: userText },
        ],
      } as any;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Mastra API error: ${res.status} ${res.statusText}`);
      const data: any = await res.json().catch(() => null);
      if (data && typeof data.text === 'string') return data.text as string;
      const text = data?.output?.text ?? data?.response?.text ?? '';
      if (typeof text === 'string' && text) return text;
      const raw = await res.text().catch(() => '');
      return raw || 'AI要約の生成に失敗しました。';
    };

    const toDateTime = (s?: string | null) => (s ? new Date(s) : undefined);
    const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const ymd2 = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

    // Prepare header and sort
    const orderLabel = payload.meta.filters.order;
    let events = [...payload.events];
    if (orderLabel === 'updated_desc') {
      events.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } else if (orderLabel === 'started_asc') {
      events.sort((a, b) => new Date(a.startedAt || a.updatedAt).getTime() - new Date(b.startedAt || b.updatedAt).getTime());
    } else {
      events.sort((a, b) => new Date(b.startedAt || b.updatedAt).getTime() - new Date(a.startedAt || a.updatedAt).getTime());
    }

    const baseHeader = [
      `レポート(${events.length}件)`,
      `期間: ${payload.meta.range.from} 〜 ${payload.meta.range.to}`,
      `条件: keywords(and)=${payload.meta.filters.and.join(', ') || '(none)'} | keywords(or)=${payload.meta.filters.or.join(', ') || '(none)'} | hashtag=${payload.meta.filters.hashTag ?? '(none)'} | prefecture=${payload.meta.filters.prefectures.join(', ') || '(none)'} | owner=${payload.meta.filters.ownerNickname ?? '(none)'} | order=${orderLabel}`,
    ].join('\n');

    if (events.length === 0) {
      await channel.send(`${baseHeader}\n\n該当イベントはありませんでした。`);
      return;
    }

    if (payload.meta.ai.enabled) {
      const baseUrl = process.env.MASTRA_BASE_URL || 'http://localhost:4111';
      const system = [
        'あなたはConnpassのイベント一覧をディスコード投稿向けに日本語でわかりやすく要約します。',
        '重要: 箇条書きや小見出しを活用し、似たイベントはグルーピング、日付順に整理。',
        'URLは各イベントに1つ添付。余計な前置きは不要。',
        payload.meta.ai.template ? `追加指示: ${payload.meta.ai.template}` : '',
      ].filter(Boolean).join('\n');
      const payloadJson = {
        meta: payload.meta,
        events: events.map((e) => ({
          id: e.id,
          title: e.title,
          url: e.url,
          group: e.groupTitle,
          startedAt: e.startedAt,
          endedAt: e.endedAt,
          updatedAt: e.updatedAt,
          place: e.place,
          address: e.address,
          limit: e.limit,
          participantCount: e.participantCount,
          hashTag: e.hashTag,
          ownerDisplayName: e.ownerDisplayName || e.ownerNickname,
        })),
      };
      const user = `以下のJSONのイベントを、チャンネル投稿用の要約にしてください。\n${JSON.stringify(payloadJson, null, 2)}`;
      try {
        const aiText = await callMastraAgent('connpassAgent', baseUrl, user, system);
        const chunks = splitForDiscord(`${baseHeader}\n\n${aiText}`);
        for (let i = 0; i < chunks.length; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          await channel.send(chunks[i]);
        }
        return;
      } catch (e) {
        // Fallback to non-AI
      }
    }

    // Non-AI fallback
    const lines: string[] = [];
    for (const e of events) {
      const s = toDateTime(e.startedAt);
      const t = toDateTime(e.endedAt);
      const time = s ? (t ? `${ymd2(s)} ${hhmm(s)} - ${hhmm(t)}` : `${ymd2(s)} ${hhmm(s)}`) : '';
      const head = time ? `${time} ` : '';
      const group = e.groupTitle ? ` [${e.groupTitle}]` : '';
      lines.push(`- ${head}${e.title}${group} ${e.url}`);
    }
    const chunks = splitForDiscord(`${baseHeader}\n\n${lines.join('\n')}`);
    for (let i = 0; i < chunks.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await channel.send(chunks[i]);
    }
  }
}
