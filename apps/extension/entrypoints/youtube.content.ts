import type { VideoWatchedMessage, WatchOutcome } from '../lib/messages';
import { SAMPLE_INTERVAL_MS, videoIdFromUrl, watchedEnough } from '../lib/watch-progress';

const PLAYER_POLL_MS = 500;
const PLAYER_POLL_LIMIT = 40;
const TOAST_HOST_ID = 'ftr-toast-host';
const TOAST_VISIBLE_MS = 4500;

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_idle',

  main() {
    let detach: (() => void) | undefined;

    function sync() {
      detach?.();
      detach = undefined;

      const videoId = videoIdFromUrl(location.href);
      if (videoId) detach = track(videoId);
    }

    sync();
    window.addEventListener('yt-navigate-finish', sync);
    window.addEventListener('popstate', sync);
  },
});

function isAdPlaying(): boolean {
  return document.querySelector('.html5-video-player.ad-showing') !== null;
}

function track(videoId: string): () => void {
  let stopped = false;
  let reported = false;
  let lastSample = 0;
  let element: HTMLVideoElement | null = null;
  let attempts = 0;

  const stillOnThisVideo = () => videoIdFromUrl(location.href) === videoId;

  const check = () => {
    if (stopped || reported || !element) return;
    if (isAdPlaying() || !stillOnThisVideo()) return;

    const now = performance.now();
    if (now - lastSample < SAMPLE_INTERVAL_MS) return;
    lastSample = now;

    if (!watchedEnough(element.currentTime, element.duration)) return;

    reported = true;
    void report(videoId);
  };

  const onEnded = () => {
    if (stopped || reported) return;
    if (isAdPlaying() || !stillOnThisVideo()) return;

    reported = true;
    void report(videoId);
  };

  const poll = setInterval(() => {
    if (stopped) return;

    const found = document.querySelector('video');
    if (!found) {
      if (++attempts >= PLAYER_POLL_LIMIT) clearInterval(poll);
      return;
    }

    clearInterval(poll);
    element = found;
    element.addEventListener('timeupdate', check);
    element.addEventListener('ended', onEnded);
  }, PLAYER_POLL_MS);

  return () => {
    stopped = true;
    clearInterval(poll);
    element?.removeEventListener('timeupdate', check);
    element?.removeEventListener('ended', onEnded);
  };
}

async function report(videoId: string) {
  const message: VideoWatchedMessage = { type: 'video-watched', videoId };

  try {
    const outcome = (await browser.runtime.sendMessage(message)) as WatchOutcome | undefined;
    if (outcome && outcome.status !== 'none') showToast(outcome);
  } catch {
    return;
  }
}

function showToast(outcome: Extract<WatchOutcome, { title: string }>) {
  document.getElementById(TOAST_HOST_ID)?.remove();

  const completed = outcome.status === 'completed';
  const accent = completed ? 'oklch(0.75 0.19 145)' : 'oklch(0.78 0.16 65)';

  const host = document.createElement('div');
  host.id = TOAST_HOST_ID;
  host.style.cssText =
    'position:fixed;right:24px;bottom:24px;z-index:2147483647;pointer-events:none;';

  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      @keyframes slide-in {
        from { transform: translateX(24px) scale(0.97); opacity: 0; }
        to   { transform: translateX(0) scale(1);       opacity: 1; }
      }
      @keyframes sweep {
        from { transform: scaleX(1); }
        to   { transform: scaleX(0); }
      }
      .card {
        display: flex;
        gap: 14px;
        align-items: center;
        min-width: 300px;
        max-width: 400px;
        padding: 16px 20px;
        border-radius: 14px;
        border: 1px solid ${accent};
        border-left: 6px solid ${accent};
        background: oklch(0.19 0.022 265);
        box-shadow: 0 0 0 1px rgba(0,0,0,.4), 0 16px 40px rgba(0,0,0,.55),
                    0 0 28px -6px ${accent};
        font-family: system-ui, -apple-system, sans-serif;
        overflow: hidden;
        position: relative;
        animation: slide-in .28s cubic-bezier(.16,1,.3,1);
      }
      .badge {
        flex: none;
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: ${accent};
        color: oklch(0.19 0.022 265);
        font-size: 19px;
        font-weight: 700;
      }
      .text { min-width: 0; }
      .heading {
        margin: 0;
        color: ${accent};
        font-size: 15px;
        font-weight: 700;
        letter-spacing: .01em;
      }
      .title {
        margin: 3px 0 0;
        color: oklch(0.95 0.005 265);
        font-size: 13px;
        line-height: 1.35;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .timer {
        position: absolute;
        left: 0; right: 0; bottom: 0;
        height: 3px;
        background: ${accent};
        transform-origin: left;
        animation: sweep ${TOAST_VISIBLE_MS}ms linear forwards;
      }
    </style>
    <div class="card">
      <div class="badge">${completed ? '&#10003;' : '&#8635;'}</div>
      <div class="text">
        <p class="heading">${completed ? 'Marked complete' : 'Already done'}</p>
        <p class="title"></p>
      </div>
      <div class="timer"></div>
    </div>
  `;

  const title = root.querySelector('.title');
  if (title) title.textContent = outcome.title;

  document.body.appendChild(host);

  setTimeout(() => {
    host.style.transition = 'opacity .3s, transform .3s';
    host.style.opacity = '0';
    host.style.transform = 'translateX(16px)';
    setTimeout(() => host.remove(), 320);
  }, TOAST_VISIBLE_MS);
}
