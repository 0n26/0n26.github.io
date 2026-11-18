import workerPath from 'hls.js/dist/hls.worker.js?url';

export type PlaybackPoint = { time: number; playing: boolean };

export function playbackPoint(
  video: Pick<HTMLVideoElement, 'currentTime' | 'paused' | 'ended'>,
  pending: PlaybackPoint | undefined,
): PlaybackPoint {
  // A replacement stream that has not initialized yet has no playback state to save.
  return pending ?? { time: video.currentTime, playing: !video.paused && !video.ended };
}

export function mediaDuration(video: Pick<HTMLVideoElement, 'duration'>) {
  return Number.isFinite(video.duration) ? video.duration : 0;
}

export async function attachHls(
  video: HTMLVideoElement,
  url: string,
  signal: AbortSignal,
  startPosition: number,
  fail: (message: string) => void,
) {
  try {
    if (video.canPlayType('application/vnd.apple.mpegurl') || video.canPlayType('application/x-mpegURL')) {
      video.src = url;
      return;
    }

    // Native HLS browsers do not need to download or evaluate the JavaScript decoder.
    const { default: Hls } = await import('hls.js');
    if (signal.aborted) return;
    if (!Hls.isSupported()) {
      fail('Браузер не поддерживает воспроизведение HLS.');
      return;
    }

    const hls = new Hls({ enableWorker: true, workerPath, startPosition });
    signal.addEventListener('abort', () => hls.destroy(), { once: true });
    hls.on(Hls.Events.ERROR, (_, error) => {
      if (error.fatal && !signal.aborted) fail('Не удалось загрузить видео.');
    });
    hls.loadSource(url);
    if (!signal.aborted) hls.attachMedia(video);
  } catch {
    if (!signal.aborted) fail('Не удалось загрузить видео.');
  }
}
