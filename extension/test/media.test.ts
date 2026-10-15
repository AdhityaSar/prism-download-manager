import { describe, expect, it } from 'vitest';
import { type MediaItem, addMedia, classifyMedia, humanSize, isIgnoredMediaUrl, mediaKey, qualityFromUrl, totalSize, visibleMedia } from '../src/shared/media';

const item = (over: Partial<MediaItem>): MediaItem => ({
  key: over.url ?? 'k',
  url: 'https://cdn.x.com/v.mp4',
  kind: 'video',
  streamKind: 'direct',
  name: 'v.mp4',
  ts: 0,
  ...over,
});

describe('classifyMedia', () => {
  it('detects manifests by type and by extension', () => {
    expect(classifyMedia({ url: 'https://x/master.m3u8', contentType: 'application/vnd.apple.mpegurl' })?.kind).toBe('hls');
    expect(classifyMedia({ url: 'https://x/a', contentType: 'application/x-mpegURL' })?.kind).toBe('hls');
    expect(classifyMedia({ url: 'https://x/live.m3u8?t=1', contentType: 'text/plain' })?.kind).toBe('hls');
    expect(classifyMedia({ url: 'https://x/manifest.mpd', contentType: 'application/dash+xml' })?.streamKind).toBe('dash');
    expect(classifyMedia({ url: 'https://x/manifest.mpd', contentType: '' })?.kind).toBe('dash');
  });
  it('detects progressive media and segments', () => {
    expect(classifyMedia({ url: 'https://x/a.mp4', contentType: 'video/mp4' })?.kind).toBe('video');
    expect(classifyMedia({ url: 'https://x/a', contentType: 'audio/mpeg' })?.kind).toBe('audio');
    expect(classifyMedia({ url: 'https://x/a.webm', contentType: 'application/octet-stream' })?.kind).toBe('video');
    expect(classifyMedia({ url: 'https://x/seg-12.ts', contentType: 'video/mp2t' })?.kind).toBe('segment');
    expect(classifyMedia({ url: 'https://x/chunk-3.m4s', contentType: 'video/iso.segment' })?.kind).toBe('segment');
  });
  it('ignores non-media', () => {
    expect(classifyMedia({ url: 'https://x/page.html', contentType: 'text/html' })).toBeNull();
    expect(classifyMedia({ url: 'https://x/a.mp4', contentType: 'text/html' })).toBeNull();
    expect(classifyMedia({ url: 'https://x/a.png', contentType: 'image/png' })).toBeNull();
    expect(classifyMedia({ url: 'https://x/a.js', contentType: 'application/javascript' })).toBeNull();
    expect(isIgnoredMediaUrl('https://rr1---sn-abc.googlevideo.com/videoplayback?x=1')).toBe(true);
    expect(isIgnoredMediaUrl('blob:https://x/1')).toBe(true);
    expect(isIgnoredMediaUrl('https://cdn.x/v.mp4')).toBe(false);
  });
});

describe('helpers', () => {
  it('normalizes media keys', () => {
    expect(mediaKey('https://x/v.mp4?range=0-100&id=7#t=5')).toBe('https://x/v.mp4?id=7');
    expect(mediaKey('https://x/v.mp4?id=7&bytes=1-2')).toBe(mediaKey('https://x/v.mp4?id=7&bytes=3-4'));
  });
  it('computes total size from 206 and 200', () => {
    expect(totalSize(206, '1024', 'bytes 0-1023/987654')).toBe(987654);
    expect(totalSize(200, '5000')).toBe(5000);
    expect(totalSize(200, undefined)).toBeUndefined();
    expect(totalSize(206, '10', 'bytes 0-9/*')).toBe(10);
  });
  it('guesses quality', () => {
    expect(qualityFromUrl('https://x/video_1080p.mp4')).toBe('1080p');
    expect(qualityFromUrl('https://x/hls/720/index.m3u8')).toBe('720p');
    expect(qualityFromUrl('https://x/movie-4k.mkv')).toBe('2160p');
    expect(qualityFromUrl('https://x/id/123456/v.mp4')).toBeUndefined();
  });
  it('formats sizes', () => {
    expect(humanSize(0)).toBe('');
    expect(humanSize(512)).toBe('512 B');
    expect(humanSize(1536)).toBe('1.5 KB');
    expect(humanSize(145 * 1024 * 1024)).toBe('145 MB');
  });
});

describe('addMedia', () => {
  it('dedupes, grows size, prunes segments once a manifest is known', () => {
    let list: MediaItem[] = [];
    list = addMedia(list, item({ url: 's1.ts', key: 's1', kind: 'segment', size: 500_000 })).list;
    expect(list).toHaveLength(1);
    list = addMedia(list, item({ url: 'v.mp4', key: 'v', size: 100_000 })).list;
    const again = addMedia(list, item({ url: 'v.mp4', key: 'v', size: 90_000 }));
    expect(again.changed).toBe(false);
    const bigger = addMedia(list, item({ url: 'v.mp4', key: 'v', size: 900_000 }));
    expect(bigger.changed).toBe(true);
    list = bigger.list;
    expect(list.find((m) => m.key === 'v')?.size).toBe(900_000);
    list = addMedia(list, item({ url: 'm.m3u8', key: 'm', kind: 'hls', streamKind: 'hls' })).list;
    expect(list.some((m) => m.kind === 'segment')).toBe(false);
    expect(addMedia(list, item({ url: 's2.ts', key: 's2', kind: 'segment', size: 500_000 })).changed).toBe(false);
    expect(visibleMedia(list)).toHaveLength(2);
  });
  it('drops tiny progressive files and caps the list', () => {
    expect(addMedia([], item({ size: 1000 })).changed).toBe(false);
    let list: MediaItem[] = [];
    for (let i = 0; i < 120; i++) list = addMedia(list, item({ key: `k${i}`, url: `u${i}` }), 100).list;
    expect(list).toHaveLength(100);
    expect(list[0]!.key).toBe('k20');
  });
});
