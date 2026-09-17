import { afterEach, describe, expect, test } from 'bun:test';
import { importPlaylist, YouTubeError } from './youtube-api';

type Route = (url: URL) => { status?: number; body: unknown };

const realFetch = globalThis.fetch;

function mockYouTube(route: Route) {
  globalThis.fetch = (async (input: string | URL) => {
    const url = new URL(String(input));
    const { status = 200, body } = route(url);
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}

function playlistTitle(title: string) {
  return { items: [{ snippet: { title } }] };
}

function items(videos: { id: string; title: string }[], nextPageToken?: string) {
  return {
    ...(nextPageToken ? { nextPageToken } : {}),
    items: videos.map((video, index) => ({
      snippet: { title: video.title, position: index },
      contentDetails: { videoId: video.id },
    })),
  };
}

function durations(entries: [string, string][]) {
  return {
    items: entries.map(([id, duration]) => ({ id, contentDetails: { duration } })),
  };
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('importPlaylist', () => {
  test('returns videos with parsed durations', async () => {
    mockYouTube((url) => {
      if (url.pathname.endsWith('/playlists')) return { body: playlistTitle('LLD Course') };
      if (url.pathname.endsWith('/playlistItems')) {
        return { body: items([{ id: 'a', title: 'Intro' }, { id: 'b', title: 'SOLID' }]) };
      }
      return { body: durations([['a', 'PT10M'], ['b', 'PT1H2M3S']]) };
    });

    const result = await importPlaylist('PL1', 'key');
    expect(result.title).toBe('LLD Course');
    expect(result.videos).toEqual([
      { videoId: 'a', title: 'Intro', durationSec: 600 },
      { videoId: 'b', title: 'SOLID', durationSec: 3723 },
    ]);
    expect(result.unavailable).toBe(0);
  });

  test('follows nextPageToken until the playlist is exhausted', async () => {
    let itemCalls = 0;
    mockYouTube((url) => {
      if (url.pathname.endsWith('/playlists')) return { body: playlistTitle('Long') };
      if (url.pathname.endsWith('/playlistItems')) {
        itemCalls++;
        return itemCalls === 1
          ? { body: items([{ id: 'a', title: 'One' }], 'page2') }
          : { body: items([{ id: 'b', title: 'Two' }]) };
      }
      return { body: durations([['a', 'PT5M'], ['b', 'PT5M']]) };
    });

    const result = await importPlaylist('PL1', 'key');
    expect(itemCalls).toBe(2);
    expect(result.videos.map((v) => v.videoId)).toEqual(['a', 'b']);
  });

  test('passes the page token through on later requests', async () => {
    const tokens: (string | null)[] = [];
    let itemCalls = 0;
    mockYouTube((url) => {
      if (url.pathname.endsWith('/playlists')) return { body: playlistTitle('Long') };
      if (url.pathname.endsWith('/playlistItems')) {
        tokens.push(url.searchParams.get('pageToken'));
        itemCalls++;
        return itemCalls === 1
          ? { body: items([{ id: 'a', title: 'One' }], 'page2') }
          : { body: items([{ id: 'b', title: 'Two' }]) };
      }
      return { body: durations([['a', 'PT5M'], ['b', 'PT5M']]) };
    });

    await importPlaylist('PL1', 'key');
    expect(tokens).toEqual([null, 'page2']);
  });

  test('drops private and deleted videos and counts them', async () => {
    mockYouTube((url) => {
      if (url.pathname.endsWith('/playlists')) return { body: playlistTitle('Course') };
      if (url.pathname.endsWith('/playlistItems')) {
        return {
          body: items([
            { id: 'a', title: 'Intro' },
            { id: 'gone', title: 'Private video' },
            { id: 'b', title: 'Outro' },
          ]),
        };
      }
      return { body: durations([['a', 'PT10M'], ['b', 'PT10M']]) };
    });

    const result = await importPlaylist('PL1', 'key');
    expect(result.videos.map((v) => v.videoId)).toEqual(['a', 'b']);
    expect(result.unavailable).toBe(1);
  });

  test('drops zero-length videos such as upcoming live streams', async () => {
    mockYouTube((url) => {
      if (url.pathname.endsWith('/playlists')) return { body: playlistTitle('Course') };
      if (url.pathname.endsWith('/playlistItems')) {
        return { body: items([{ id: 'a', title: 'Intro' }, { id: 'live', title: 'Stream' }]) };
      }
      return { body: durations([['a', 'PT10M'], ['live', 'P0D']]) };
    });

    const result = await importPlaylist('PL1', 'key');
    expect(result.videos).toHaveLength(1);
    expect(result.unavailable).toBe(1);
  });

  test('batches duration lookups 50 ids at a time', async () => {
    const batchSizes: number[] = [];
    const many = Array.from({ length: 120 }, (_, i) => ({ id: `v${i}`, title: `Video ${i}` }));
    mockYouTube((url) => {
      if (url.pathname.endsWith('/playlists')) return { body: playlistTitle('Big') };
      if (url.pathname.endsWith('/playlistItems')) return { body: items(many) };
      const ids = (url.searchParams.get('id') ?? '').split(',');
      batchSizes.push(ids.length);
      return { body: durations(ids.map((id) => [id, 'PT5M'] as [string, string])) };
    });

    const result = await importPlaylist('PL1', 'key');
    expect(batchSizes).toEqual([50, 50, 20]);
    expect(result.videos).toHaveLength(120);
  });

  test("surfaces YouTube's own error message", async () => {
    mockYouTube(() => ({
      status: 403,
      body: { error: { code: 403, message: 'The request cannot be completed because quota was exceeded.' } },
    }));

    await expect(importPlaylist('PL1', 'bad-key')).rejects.toThrow(/quota was exceeded/);
  });

  test('reports a missing or private playlist clearly', async () => {
    mockYouTube(() => ({ body: { items: [] } }));
    await expect(importPlaylist('PL1', 'key')).rejects.toThrow(/private/i);
  });

  test('reports an empty playlist', async () => {
    mockYouTube((url) => {
      if (url.pathname.endsWith('/playlists')) return { body: playlistTitle('Empty') };
      return { body: items([]) };
    });
    await expect(importPlaylist('PL1', 'key')).rejects.toThrow(/no videos/i);
  });

  test('reports a playlist where nothing is watchable', async () => {
    mockYouTube((url) => {
      if (url.pathname.endsWith('/playlists')) return { body: playlistTitle('Dead') };
      if (url.pathname.endsWith('/playlistItems')) {
        return { body: items([{ id: 'gone', title: 'Deleted video' }]) };
      }
      return { body: durations([]) };
    });
    await expect(importPlaylist('PL1', 'key')).rejects.toThrow(YouTubeError);
  });

  test('turns a network failure into a readable message', async () => {
    globalThis.fetch = (() =>
      Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch;
    await expect(importPlaylist('PL1', 'key')).rejects.toThrow(/Could not reach YouTube/);
  });

  test('never puts the api key in the thrown message', async () => {
    mockYouTube(() => ({ status: 400, body: { error: { code: 400, message: 'Bad Request' } } }));
    const error = await importPlaylist('PL1', 'SECRET_KEY').catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain('SECRET_KEY');
  });
});
