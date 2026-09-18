export const COMPLETION_RATIO = 0.9;
export const SAMPLE_INTERVAL_MS = 5000;

export function watchedEnough(
  currentTime: number,
  duration: number,
  ratio = COMPLETION_RATIO,
): boolean {
  if (!Number.isFinite(duration) || duration <= 0) return false;
  if (!Number.isFinite(currentTime) || currentTime < 0) return false;

  return currentTime / duration >= ratio;
}

export function videoIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith('/watch')) return null;
    return parsed.searchParams.get('v');
  } catch {
    return null;
  }
}
