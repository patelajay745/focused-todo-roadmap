import { parseIsoDuration, type ImportedVideo } from '@ftr/core';
import { z } from 'zod';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const PAGE_SIZE = 50;
const MAX_PAGES = 40;

export class YouTubeError extends Error {}

const errorBodySchema = z.object({
  error: z.object({ code: z.number(), message: z.string() }),
});

const playlistsSchema = z.object({
  items: z.array(z.object({ snippet: z.object({ title: z.string() }) })),
});

const playlistItemsSchema = z.object({
  nextPageToken: z.string().optional(),
  items: z.array(
    z.object({
      snippet: z.object({ title: z.string(), position: z.number() }),
      contentDetails: z.object({ videoId: z.string() }),
    }),
  ),
});

const videosSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      contentDetails: z.object({ duration: z.string() }),
    }),
  ),
});

async function request<T>(
  resource: string,
  params: Record<string, string>,
  schema: z.ZodType<T>,
): Promise<T> {
  const url = new URL(`${API_BASE}/${resource}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  let body: unknown;
  try {
    const response = await fetch(url);
    body = await response.json();
    if (!response.ok) {
      const parsed = errorBodySchema.safeParse(body);
      throw new YouTubeError(
        parsed.success ? parsed.data.error.message : `YouTube request failed (${response.status})`,
      );
    }
  } catch (cause) {
    if (cause instanceof YouTubeError) throw cause;
    throw new YouTubeError('Could not reach YouTube. Check your connection.');
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new YouTubeError('YouTube returned an unexpected response.');
  return parsed.data;
}

async function fetchTitle(playlistId: string, key: string): Promise<string> {
  const data = await request(
    'playlists',
    { part: 'snippet', id: playlistId, key },
    playlistsSchema,
  );
  const title = data.items[0]?.snippet.title;
  if (!title) throw new YouTubeError('Playlist not found, or it is private.');
  return title;
}

type PlaylistEntry = { videoId: string; title: string };

async function fetchEntries(
  playlistId: string,
  key: string,
  onProgress?: (fetched: number) => void,
): Promise<PlaylistEntry[]> {
  const entries: PlaylistEntry[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await request(
      'playlistItems',
      {
        part: 'snippet,contentDetails',
        playlistId,
        maxResults: String(PAGE_SIZE),
        key,
        ...(pageToken ? { pageToken } : {}),
      },
      playlistItemsSchema,
    );

    for (const item of data.items) {
      entries.push({ videoId: item.contentDetails.videoId, title: item.snippet.title });
    }
    onProgress?.(entries.length);

    if (!data.nextPageToken) return entries;
    pageToken = data.nextPageToken;
  }

  throw new YouTubeError(
    `Playlist is larger than ${MAX_PAGES * PAGE_SIZE} videos, which this importer does not support.`,
  );
}

async function fetchDurations(videoIds: string[], key: string): Promise<Map<string, number>> {
  const durations = new Map<string, number>();

  for (let start = 0; start < videoIds.length; start += PAGE_SIZE) {
    const batch = videoIds.slice(start, start + PAGE_SIZE);
    const data = await request(
      'videos',
      { part: 'contentDetails', id: batch.join(','), key },
      videosSchema,
    );
    for (const item of data.items) {
      durations.set(item.id, parseIsoDuration(item.contentDetails.duration));
    }
  }

  return durations;
}

export type PlaylistImport = {
  playlistId: string;
  title: string;
  videos: ImportedVideo[];
  unavailable: number;
};

export async function importPlaylist(
  playlistId: string,
  key: string,
  onProgress?: (fetched: number) => void,
): Promise<PlaylistImport> {
  const title = await fetchTitle(playlistId, key);
  const entries = await fetchEntries(playlistId, key, onProgress);

  if (entries.length === 0) throw new YouTubeError('That playlist has no videos.');

  const durations = await fetchDurations(
    entries.map((entry) => entry.videoId),
    key,
  );

  // videos.list omits private and deleted videos, so a missing duration is the only signal.
  const videos = entries.flatMap((entry) => {
    const durationSec = durations.get(entry.videoId);
    if (durationSec === undefined || durationSec === 0) return [];
    return [{ videoId: entry.videoId, title: entry.title, durationSec }];
  });

  if (videos.length === 0) {
    throw new YouTubeError('None of the videos in that playlist are available to watch.');
  }

  return { playlistId, title, videos, unavailable: entries.length - videos.length };
}
