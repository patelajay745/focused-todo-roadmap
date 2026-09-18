export type VideoWatchedMessage = {
  type: 'video-watched';
  videoId: string;
};

export type ExtensionMessage = VideoWatchedMessage;

export type WatchOutcome =
  | { status: 'completed'; title: string }
  | { status: 'already'; title: string }
  | { status: 'none' };

export function isVideoWatched(message: unknown): message is VideoWatchedMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as VideoWatchedMessage).type === 'video-watched' &&
    typeof (message as VideoWatchedMessage).videoId === 'string'
  );
}
