const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{2,64}$/;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const ISO_DURATION_PATTERN = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

export function parsePlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (PLAYLIST_ID_PATTERN.test(trimmed) && !trimmed.includes("/")) return trimmed;

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const id = url.searchParams.get("list");
    return id && PLAYLIST_ID_PATTERN.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function parseVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (VIDEO_ID_PATTERN.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1);
      return VIDEO_ID_PATTERN.test(id) ? id : null;
    }
    const fromQuery = url.searchParams.get("v");
    if (fromQuery && VIDEO_ID_PATTERN.test(fromQuery)) return fromQuery;

    const fromPath = url.pathname.split("/").at(-1) ?? "";
    return VIDEO_ID_PATTERN.test(fromPath) ? fromPath : null;
  } catch {
    return null;
  }
}

export function parseIsoDuration(iso: string): number {
  const match = ISO_DURATION_PATTERN.exec(iso.trim());
  if (!match) return 0;

  const [, days, hours, minutes, seconds] = match;
  return Math.round(
    Number(days ?? 0) * 86400 +
      Number(hours ?? 0) * 3600 +
      Number(minutes ?? 0) * 60 +
      Number(seconds ?? 0),
  );
}

export function formatDuration(sec: number): string {
  const safe = Math.max(0, Math.round(sec));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${safe}s`;
}

export function watchUrl(videoId: string, playlistId?: string): string {
  const url = new URL("https://www.youtube.com/watch");
  url.searchParams.set("v", videoId);
  if (playlistId) url.searchParams.set("list", playlistId);
  return url.toString();
}
