import { describe, expect, test } from 'bun:test';
import { videoIdFromUrl, watchedEnough } from './watch-progress';

describe('watchedEnough', () => {
  test('is true at or past the threshold', () => {
    expect(watchedEnough(90, 100)).toBe(true);
    expect(watchedEnough(95, 100)).toBe(true);
    expect(watchedEnough(100, 100)).toBe(true);
  });

  test('is false before the threshold', () => {
    expect(watchedEnough(89.9, 100)).toBe(false);
    expect(watchedEnough(0, 100)).toBe(false);
  });

  test('ignores a live stream with infinite duration', () => {
    expect(watchedEnough(3600, Number.POSITIVE_INFINITY)).toBe(false);
  });

  test('ignores an unloaded player', () => {
    expect(watchedEnough(0, 0)).toBe(false);
    expect(watchedEnough(10, Number.NaN)).toBe(false);
    expect(watchedEnough(Number.NaN, 100)).toBe(false);
  });

  test('ignores a negative current time', () => {
    expect(watchedEnough(-5, 100)).toBe(false);
  });

  test('honours a custom ratio', () => {
    expect(watchedEnough(50, 100, 0.5)).toBe(true);
    expect(watchedEnough(49, 100, 0.5)).toBe(false);
  });

  test('a short ad reaching its end still satisfies the ratio', () => {
    expect(watchedEnough(15, 15)).toBe(true);
  });
});

describe('videoIdFromUrl', () => {
  test('reads the id from a watch URL', () => {
    expect(videoIdFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(videoIdFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc&index=2')).toBe(
      'dQw4w9WgXcQ',
    );
  });

  test('returns null away from the watch page', () => {
    expect(videoIdFromUrl('https://www.youtube.com/')).toBeNull();
    expect(videoIdFromUrl('https://www.youtube.com/feed/subscriptions')).toBeNull();
    expect(videoIdFromUrl('https://www.youtube.com/shorts/abc')).toBeNull();
    expect(videoIdFromUrl('not a url')).toBeNull();
  });

  test('returns null when the watch URL has no id', () => {
    expect(videoIdFromUrl('https://www.youtube.com/watch')).toBeNull();
  });
});
