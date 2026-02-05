import { describe, it, expect } from 'vitest';
import { buildEventEmbed, buildEventButtons } from './eventEmbed.js';
import type { ConnpassEvent } from '@connpass-discord-bot/core';

function createTestEvent(overrides: Partial<ConnpassEvent> = {}): ConnpassEvent {
  return {
    id: 1,
    title: 'TypeScript勉強会',
    catchPhrase: 'TypeScriptを学ぼう',
    description: 'TypeScriptの基礎から応用まで',
    url: 'https://connpass.com/event/1/',
    hashTag: 'typescript',
    startedAt: '2024-06-15T13:00:00+09:00',
    endedAt: '2024-06-15T17:00:00+09:00',
    limit: 100,
    participantCount: 50,
    waitingCount: 5,
    ownerNickname: 'testowner',
    ownerDisplayName: 'Test Owner',
    place: '東京都渋谷区',
    address: '渋谷1-1-1',
    lat: 35.6580,
    lon: 139.7016,
    groupTitle: 'TypeScript Users',
    groupUrl: 'https://connpass.com/group/ts/',
    updatedAt: '2024-06-10T10:00:00+09:00',
    ...overrides,
  };
}

describe('buildEventEmbed', () => {
  it('タイトルとURLが正しく設定される', () => {
    const event = createTestEvent();
    const embed = buildEventEmbed(event);
    const json = embed.toJSON();

    expect(json.title).toBe('TypeScript勉強会');
    expect(json.url).toBe('https://connpass.com/event/1/');
  });

  it('catchPhrase が description に設定される', () => {
    const event = createTestEvent({ catchPhrase: '初心者歓迎!' });
    const embed = buildEventEmbed(event);
    const json = embed.toJSON();

    expect(json.description).toBe('初心者歓迎!');
  });

  it('catchPhrase が空の場合は description が設定されない', () => {
    const event = createTestEvent({ catchPhrase: '' });
    const embed = buildEventEmbed(event);
    const json = embed.toJSON();

    expect(json.description).toBeUndefined();
  });

  it('開催日時フィールドが追加される', () => {
    const event = createTestEvent();
    const embed = buildEventEmbed(event);
    const json = embed.toJSON();

    const whenField = json.fields?.find(f => f.name === '開催日時');
    expect(whenField).toBeDefined();
    expect(whenField!.value).toContain('2024');
  });

  it('会場情報が追加される', () => {
    const event = createTestEvent();
    const embed = buildEventEmbed(event);
    const json = embed.toJSON();

    const venueField = json.fields?.find(f => f.name === '会場');
    expect(venueField).toBeDefined();
    expect(venueField!.value).toContain('東京都渋谷区');
  });

  it('会場情報がない場合はフィールドが追加されない', () => {
    const event = createTestEvent({ place: undefined, address: undefined });
    const embed = buildEventEmbed(event);
    const json = embed.toJSON();

    const venueField = json.fields?.find(f => f.name === '会場');
    expect(venueField).toBeUndefined();
  });

  it('参加者数が limit ありの形式で表示される', () => {
    const event = createTestEvent({ participantCount: 50, limit: 100 });
    const embed = buildEventEmbed(event);
    const json = embed.toJSON();

    const participantField = json.fields?.find(f => f.name === '参加');
    expect(participantField!.value).toBe('50/100');
  });

  it('limit がない場合は参加者数のみ表示される', () => {
    const event = createTestEvent({ participantCount: 30, limit: undefined });
    const embed = buildEventEmbed(event);
    const json = embed.toJSON();

    const participantField = json.fields?.find(f => f.name === '参加');
    expect(participantField!.value).toBe('30');
  });

  it('キャンセル待ちが0より大きい場合はフィールドが追加される', () => {
    const event = createTestEvent({ waitingCount: 5 });
    const embed = buildEventEmbed(event);
    const json = embed.toJSON();

    const waitingField = json.fields?.find(f => f.name === 'キャンセル待ち');
    expect(waitingField).toBeDefined();
    expect(waitingField!.value).toBe('5');
  });

  it('キャンセル待ちが0の場合はフィールドが追加されない', () => {
    const event = createTestEvent({ waitingCount: 0 });
    const embed = buildEventEmbed(event);
    const json = embed.toJSON();

    const waitingField = json.fields?.find(f => f.name === 'キャンセル待ち');
    expect(waitingField).toBeUndefined();
  });

  it('ハッシュタグが設定される', () => {
    const event = createTestEvent({ hashTag: 'typescript' });
    const embed = buildEventEmbed(event);
    const json = embed.toJSON();

    const hashField = json.fields?.find(f => f.name === 'ハッシュタグ');
    expect(hashField).toBeDefined();
    expect(hashField!.value).toBe('#typescript');
  });

  it('ハッシュタグが空の場合はフィールドが追加されない', () => {
    const event = createTestEvent({ hashTag: '' });
    const embed = buildEventEmbed(event);
    const json = embed.toJSON();

    const hashField = json.fields?.find(f => f.name === 'ハッシュタグ');
    expect(hashField).toBeUndefined();
  });

  it('グループ情報がURLありの場合はリンク形式で表示される', () => {
    const event = createTestEvent({
      groupTitle: 'TypeScript Users',
      groupUrl: 'https://connpass.com/group/ts/',
    });
    const embed = buildEventEmbed(event);
    const json = embed.toJSON();

    const groupField = json.fields?.find(f => f.name === 'グループ');
    expect(groupField).toBeDefined();
    expect(groupField!.value).toContain('[TypeScript Users]');
    expect(groupField!.value).toContain('https://connpass.com/group/ts/');
  });

  it('imageUrl がある場合はサムネイルが設定される', () => {
    const event = createTestEvent({ imageUrl: 'https://example.com/image.png' });
    const embed = buildEventEmbed(event);
    const json = embed.toJSON();

    expect(json.thumbnail?.url).toBe('https://example.com/image.png');
  });

  it('色が設定される', () => {
    const event = createTestEvent();
    const embed = buildEventEmbed(event);
    const json = embed.toJSON();

    expect(json.color).toBe(0x00a3ff);
  });
});

describe('buildEventButtons', () => {
  it('基本ボタンが含まれる（詳細、登壇、重複チェック、Web）', () => {
    const event = createTestEvent();
    const row = buildEventButtons(event);
    const json = row.toJSON();

    expect(json.components.length).toBeGreaterThanOrEqual(4);

    // カスタムIDのチェック
    const customIds = json.components
      .filter((c: any) => c.custom_id)
      .map((c: any) => c.custom_id);
    expect(customIds).toContain('ev:detail:1');
    expect(customIds).toContain('ev:speakers:1');
    expect(customIds).toContain('ev:conflict:1');
  });

  it('Webリンクボタンが含まれる', () => {
    const event = createTestEvent();
    const row = buildEventButtons(event);
    const json = row.toJSON();

    const webButton = json.components.find((c: any) => c.label === 'Web') as any;
    expect(webButton).toBeDefined();
    expect(webButton.url).toBe('https://connpass.com/event/1/');
  });

  it('緯度経度がある場合は地図ボタンが含まれる', () => {
    const event = createTestEvent({ lat: 35.6580, lon: 139.7016 });
    const row = buildEventButtons(event);
    const json = row.toJSON();

    const mapButton = json.components.find((c: any) => c.label === '地図') as any;
    expect(mapButton).toBeDefined();
    expect(mapButton.url).toContain('google.com/maps');
    expect(mapButton.url).toContain('35.658');
  });

  it('place のみある場合は地図ボタンが検索URLになる', () => {
    const event = createTestEvent({
      lat: undefined,
      lon: undefined,
      place: '渋谷ヒカリエ',
      address: undefined,
    });
    const row = buildEventButtons(event);
    const json = row.toJSON();

    const mapButton = json.components.find((c: any) => c.label === '地図') as any;
    expect(mapButton).toBeDefined();
    expect(mapButton.url).toContain('google.com/maps/search');
    expect(mapButton.url).toContain(encodeURIComponent('渋谷ヒカリエ'));
  });

  it('場所情報がない場合は地図ボタンが含まれない', () => {
    const event = createTestEvent({
      lat: undefined,
      lon: undefined,
      place: undefined,
      address: undefined,
    });
    const row = buildEventButtons(event);
    const json = row.toJSON();

    const mapButton = json.components.find((c: any) => c.label === '地図');
    expect(mapButton).toBeUndefined();
  });
});
