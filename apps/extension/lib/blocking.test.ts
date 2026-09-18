import { describe, expect, test } from 'bun:test';
import {
  buildRules,
  clockOf,
  DEFAULT_BLOCKING,
  evaluateBlocking,
  isWithinWindow,
  normaliseSite,
  YOUTUBE_ALLOW_RULE_ID,
  type BlockingSettings,
} from './blocking';

const settings = (overrides: Partial<BlockingSettings> = {}): BlockingSettings => ({
  ...DEFAULT_BLOCKING,
  enabled: true,
  ...overrides,
});

const at = (clock: string) => new Date(`2026-01-05T${clock}:00`);

describe('isWithinWindow', () => {
  test('covers a normal evening window', () => {
    expect(isWithinWindow('20:00', '19:00', '22:00')).toBe(true);
    expect(isWithinWindow('19:00', '19:00', '22:00')).toBe(true);
    expect(isWithinWindow('18:59', '19:00', '22:00')).toBe(false);
    expect(isWithinWindow('22:00', '19:00', '22:00')).toBe(false);
  });

  test('handles a window that crosses midnight', () => {
    expect(isWithinWindow('23:30', '22:00', '02:00')).toBe(true);
    expect(isWithinWindow('01:00', '22:00', '02:00')).toBe(true);
    expect(isWithinWindow('03:00', '22:00', '02:00')).toBe(false);
    expect(isWithinWindow('12:00', '22:00', '02:00')).toBe(false);
  });

  test('treats an equal start and end as all day', () => {
    expect(isWithinWindow('04:00', '00:00', '00:00')).toBe(true);
  });
});

describe('clockOf', () => {
  test('pads to HH:MM', () => {
    expect(clockOf(new Date('2026-01-05T09:05:00'))).toBe('09:05');
    expect(clockOf(new Date('2026-01-05T23:59:00'))).toBe('23:59');
  });
});

describe('evaluateBlocking', () => {
  test('is off when disabled', () => {
    const state = evaluateBlocking({
      settings: settings({ enabled: false }),
      now: at('20:00'),
      targetDone: false,
      bypassUntil: null,
    });
    expect(state).toEqual({ active: false, reason: 'disabled' });
  });

  test('blocks inside the window with work outstanding', () => {
    const state = evaluateBlocking({
      settings: settings(),
      now: at('20:00'),
      targetDone: false,
      bypassUntil: null,
    });
    expect(state).toEqual({ active: true, reason: 'blocking' });
  });

  test('is off outside the window', () => {
    const state = evaluateBlocking({
      settings: settings(),
      now: at('14:00'),
      targetDone: false,
      bypassUntil: null,
    });
    expect(state.reason).toBe('outside-window');
  });

  test('stops once today is cleared', () => {
    const state = evaluateBlocking({
      settings: settings(),
      now: at('20:00'),
      targetDone: true,
      bypassUntil: null,
    });
    expect(state).toEqual({ active: false, reason: 'target-done' });
  });

  test('keeps blocking when told to ignore a finished target', () => {
    const state = evaluateBlocking({
      settings: settings({ stopWhenTargetDone: false }),
      now: at('20:00'),
      targetDone: true,
      bypassUntil: null,
    });
    expect(state.active).toBe(true);
  });

  test('an active bypass suspends blocking', () => {
    const now = at('20:00');
    const state = evaluateBlocking({
      settings: settings(),
      now,
      targetDone: false,
      bypassUntil: now.getTime() + 60_000,
    });
    expect(state).toEqual({ active: false, reason: 'bypassed' });
  });

  test('an expired bypass does not', () => {
    const now = at('20:00');
    const state = evaluateBlocking({
      settings: settings(),
      now,
      targetDone: false,
      bypassUntil: now.getTime() - 1,
    });
    expect(state.active).toBe(true);
  });

  test('is off with no sites configured', () => {
    const state = evaluateBlocking({
      settings: settings({ sites: [] }),
      now: at('20:00'),
      targetDone: false,
      bypassUntil: null,
    });
    expect(state.reason).toBe('no-sites');
  });
});

describe('normaliseSite', () => {
  test('strips scheme, www and path', () => {
    expect(normaliseSite('https://www.Instagram.com/explore')).toBe('instagram.com');
    expect(normaliseSite('  reddit.com  ')).toBe('reddit.com');
    expect(normaliseSite('http://x.com')).toBe('x.com');
  });
});

describe('buildRules', () => {
  test('always allows YouTube watch pages at a higher priority than the block', () => {
    const rules = buildRules(['youtube.com']);
    const allow = rules.find((rule) => rule.id === YOUTUBE_ALLOW_RULE_ID)!;
    const block = rules.find((rule) => rule.condition.urlFilter === '||youtube.com/')!;

    expect(allow.action.type).toBe('allow');
    expect(allow.priority).toBeGreaterThan(block.priority);
  });

  test('the allow pattern matches watch URLs and nothing else', () => {
    const allow = buildRules(['youtube.com']).find((r) => r.id === YOUTUBE_ALLOW_RULE_ID)!;
    const pattern = new RegExp(allow.condition.regexFilter!);

    expect(pattern.test('https://www.youtube.com/watch?v=abc')).toBe(true);
    expect(pattern.test('https://youtube.com/watch?v=abc&list=PL1')).toBe(true);
    expect(pattern.test('https://m.youtube.com/watch?v=abc')).toBe(true);

    expect(pattern.test('https://www.youtube.com/')).toBe(false);
    expect(pattern.test('https://www.youtube.com/feed/subscriptions')).toBe(false);
    expect(pattern.test('https://www.youtube.com/shorts/abc')).toBe(false);
    expect(pattern.test('https://www.youtube.com/@channel')).toBe(false);
  });

  test('redirects every configured site to the blocked page', () => {
    const rules = buildRules(['instagram.com', 'reddit.com']);
    const blocks = rules.filter((rule) => rule.action.type === 'redirect');

    expect(blocks).toHaveLength(2);
    for (const rule of blocks) {
      expect(rule.condition.resourceTypes).toEqual(['main_frame']);
      expect(rule.action).toMatchObject({ redirect: { extensionPath: '/blocked.html' } });
    }
  });

  test('gives every rule a unique id', () => {
    const rules = buildRules(DEFAULT_BLOCKING.sites);
    expect(new Set(rules.map((rule) => rule.id)).size).toBe(rules.length);
  });

  test('normalises sites before building filters', () => {
    const rules = buildRules(['https://www.Instagram.com/']);
    expect(rules.some((rule) => rule.condition.urlFilter === '||instagram.com/')).toBe(true);
  });

  test('ignores blank entries', () => {
    expect(buildRules(['', '   ', 'reddit.com'])).toHaveLength(2);
  });
});
