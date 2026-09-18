export type BlockingSettings = {
  enabled: boolean;
  startTime: string;
  endTime: string;
  sites: string[];
  stopWhenTargetDone: boolean;
};

export const DEFAULT_BLOCKING: BlockingSettings = {
  enabled: false,
  startTime: '19:00',
  endTime: '22:00',
  sites: [
    'youtube.com',
    'instagram.com',
    'reddit.com',
    'x.com',
    'twitter.com',
    'facebook.com',
    'tiktok.com',
    'netflix.com',
  ],
  stopWhenTargetDone: true,
};

export const YOUTUBE_ALLOW_RULE_ID = 1;
export const SITE_RULE_OFFSET = 100;

export type BlockingReason =
  | 'disabled'
  | 'no-sites'
  | 'outside-window'
  | 'target-done'
  | 'bypassed'
  | 'blocking';

export type BlockingState = {
  active: boolean;
  reason: BlockingReason;
};

export function toMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
}

export function isWithinWindow(now: string, start: string, end: string): boolean {
  const at = toMinutes(now);
  const from = toMinutes(start);
  const to = toMinutes(end);

  if (from === to) return true;
  if (from < to) return at >= from && at < to;
  return at >= from || at < to;
}

export function clockOf(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function evaluateBlocking(input: {
  settings: BlockingSettings;
  now: Date;
  targetDone: boolean;
  bypassUntil: number | null;
}): BlockingState {
  const { settings, now, targetDone, bypassUntil } = input;

  if (!settings.enabled) return { active: false, reason: 'disabled' };
  if (settings.sites.length === 0) return { active: false, reason: 'no-sites' };
  if (bypassUntil !== null && now.getTime() < bypassUntil) {
    return { active: false, reason: 'bypassed' };
  }
  if (!isWithinWindow(clockOf(now), settings.startTime, settings.endTime)) {
    return { active: false, reason: 'outside-window' };
  }
  if (settings.stopWhenTargetDone && targetDone) {
    return { active: false, reason: 'target-done' };
  }

  return { active: true, reason: 'blocking' };
}

export type BlockRule = {
  id: number;
  priority: number;
  action:
    | { type: 'allow' }
    | { type: 'redirect'; redirect: { extensionPath: string } };
  condition: {
    urlFilter?: string;
    regexFilter?: string;
    resourceTypes: ['main_frame'];
  };
};

export function normaliseSite(site: string): string {
  return site
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

export function buildRules(sites: string[], blockedPath = '/blocked.html'): BlockRule[] {
  const youtubeAllow: BlockRule = {
    id: YOUTUBE_ALLOW_RULE_ID,
    priority: 2,
    action: { type: 'allow' },
    condition: {
      regexFilter: String.raw`^https?://(www\.|m\.)?youtube\.com/watch\?`,
      resourceTypes: ['main_frame'],
    },
  };

  const blocks = sites
    .map(normaliseSite)
    .filter(Boolean)
    .map((site, index) => ({
      id: SITE_RULE_OFFSET + index,
      priority: 1,
      action: { type: 'redirect' as const, redirect: { extensionPath: blockedPath } },
      condition: {
        urlFilter: `||${site}/`,
        resourceTypes: ['main_frame'] as ['main_frame'],
      },
    }));

  return [youtubeAllow, ...blocks];
}
