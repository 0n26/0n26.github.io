import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { enhanceVideo } from './anime4k';
import { attachHls, mediaDuration, playbackPoint, readPosition, savePosition } from './media';
import type { PlaybackPoint } from './media';

type WebKitVideo = HTMLVideoElement & {
  webkitSupportsFullscreen?: boolean;
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitPresentationMode?: 'inline' | 'fullscreen' | 'picture-in-picture';
  webkitSupportsPresentationMode?: (mode: 'picture-in-picture') => boolean;
  webkitSetPresentationMode?: (mode: 'inline' | 'picture-in-picture') => void;
};

type VideoEvent = SyntheticEvent<HTMLVideoElement>;

export function usePlayerMedia(episodeKey: string, streams: readonly { quality: number; url: string }[]) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<WebKitVideo>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [initialTime] = useState(() => readPosition(episodeKey));
  const lastPosition = useRef(initialTime);
  const pending = useRef<PlaybackPoint | undefined>(initialTime ? { time: initialTime, playing: false } : undefined);
  const mediaSignal = useRef<AbortSignal | undefined>(undefined);

  const options = useMemo(() => [...streams].sort((a, b) => b.quality - a.quality).map(({ quality, url }) => ({
    url, value: String(quality), label: `${quality}p`,
  })), [streams]);
  const [quality, setQuality] = useState<string>();
  const stream = options.find(({ value }) => value === quality) ?? options[0];
  const url = stream?.url;

  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [scrubbing, setScrubbing] = useState<number>();
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [pictureInPicture, setPictureInPicture] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [mediaError, setMediaError] = useState<string>();
  const [playNotice, setPlayNotice] = useState<string>();
  const [modeNotice, setModeNotice] = useState<string>();
  const [enhancementNotice, setEnhancementNotice] = useState<string>();

  const startPlayback = useCallback(() => {
    const video = videoRef.current;
    const signal = mediaSignal.current;
    if (!video || !signal || signal.aborted) return;
    setPlayNotice(undefined);
    void video.play().catch((error: unknown) => {
      if (signal.aborted || !video.paused || (error instanceof DOMException && error.name === 'AbortError')) return;
      setPlayNotice('Не удалось начать воспроизведение. Нажмите «Воспроизвести».');
    });
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;
    const controller = new AbortController();
    const { signal } = controller;
    mediaSignal.current = signal;
    setReady(false);
    setWaiting(false);
    setPlaying(false);
    setTime(pending.current?.time ?? 0);
    setDuration(0);
    setScrubbing(undefined);
    setMediaError(undefined);
    setPlayNotice(undefined);

    let initialized = false;
    const remember = (force: boolean) => {
      if (!initialized || signal.aborted || pending.current) return;
      const position = video.ended ? 0 : Math.floor(video.currentTime);
      if (position === lastPosition.current || (!force && Math.abs(position - lastPosition.current) < 5)) return;
      lastPosition.current = position;
      savePosition(episodeKey, position);
    };
    const flush = () => remember(true);
    video.addEventListener('timeupdate', () => remember(false), { signal });
    for (const event of ['pause', 'seeked', 'ended']) video.addEventListener(event, flush, { signal });
    window.addEventListener('pagehide', flush, { signal });

    const fail = (message: string) => {
      flush();
      // Aborting HLS detaches the media before the viewer can choose another quality.
      pending.current = playbackPoint(video, pending.current);
      controller.abort();
      video.pause();
      setPlaying(false);
      setMediaError(message);
    };
    video.addEventListener('error', () => fail('Не удалось воспроизвести видео.'), { signal });
    video.addEventListener('loadedmetadata', () => {
      const saved = pending.current;
      const length = mediaDuration(video);
      if (saved) {
        pending.current = undefined;
        if (saved.time < length) video.currentTime = saved.time;
      }
      initialized = true;
      setDuration(length);
      setTime(video.currentTime);
      setReady(true);
      if (saved?.playing) startPlayback();
    }, { signal, once: true });
    if (new URL(url).pathname.toLowerCase().endsWith('.mp4')) video.src = url;
    else void attachHls(video, url, signal, pending.current?.time ?? -1, fail);

    return () => {
      flush();
      controller.abort();
      video.removeAttribute('src');
      video.load();
    };
  }, [url, attempt, episodeKey, startPlayback]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!enhanced || mediaError || !video || !canvas) return;
    return enhanceVideo(video, canvas, (message) => {
      setEnhanced(false);
      setEnhancementNotice(message);
    });
  }, [enhanced, mediaError, url]);

  const video = videoRef.current;
  const canFullscreen = document.fullscreenEnabled || (ready && video?.webkitSupportsFullscreen && !!video.webkitEnterFullscreen);
  const canPiP = ready && !mediaError && (
    (document.pictureInPictureEnabled && !!video?.requestPictureInPicture) ||
    (video?.webkitSupportsPresentationMode?.('picture-in-picture') && !!video.webkitSetPresentationMode)
  );
  const hasStream = !!url;
  useEffect(() => {
    const video = videoRef.current;
    if (!hasStream || !video) return;
    const controller = new AbortController();
    const { signal } = controller;
    document.addEventListener('fullscreenchange', () => setFullscreen(document.fullscreenElement === rootRef.current), { signal });
    video.addEventListener('webkitbeginfullscreen', () => setFullscreen(true), { signal });
    video.addEventListener('webkitendfullscreen', () => setFullscreen(false), { signal });
    video.addEventListener('enterpictureinpicture', () => setPictureInPicture(true), { signal });
    video.addEventListener('leavepictureinpicture', () => setPictureInPicture(false), { signal });
    video.addEventListener('webkitpresentationmodechanged', () => {
      setPictureInPicture(video.webkitPresentationMode === 'picture-in-picture');
    }, { signal });
    return () => controller.abort();
  }, [hasStream]);

  async function toggleFullscreen() {
    const root = rootRef.current;
    if (!root) return;
    setModeNotice(undefined);
    try {
      if (document.fullscreenElement === root) await document.exitFullscreen();
      else if (document.fullscreenEnabled) await root.requestFullscreen();
      else if (fullscreen) video?.webkitExitFullscreen?.();
      else video?.webkitEnterFullscreen?.();
    } catch {
      setModeNotice('Не удалось переключить полноэкранный режим.');
    }
  }

  async function togglePictureInPicture() {
    if (!video || !canPiP) return;
    setModeNotice(undefined);
    try {
      if (document.pictureInPictureElement === video) await document.exitPictureInPicture();
      else if (document.pictureInPictureEnabled && video.requestPictureInPicture) await video.requestPictureInPicture();
      else video.webkitSetPresentationMode?.(pictureInPicture ? 'inline' : 'picture-in-picture');
    } catch {
      setModeNotice('Не удалось переключить режим «Картинка в картинке».');
    }
  }

  function changeQuality(value: string) {
    const next = options.find((option) => option.value === value);
    const video = videoRef.current;
    if (!next || !video) return;
    if (next.url !== url) pending.current = playbackPoint(video, pending.current);
    setQuality(value);
  }

  function readPlaying({ currentTarget }: VideoEvent) {
    setPlaying(!currentTarget.paused && !currentTarget.ended);
  }

  function togglePlayback() {
    if (!video || !ready || mediaError) return;
    if (video.paused || video.ended) startPlayback();
    else video.pause();
  }

  function toggleMute() {
    if (video) video.muted = !video.muted;
  }

  function changeVolume(value: number) {
    if (!video) return;
    video.muted = value === 0;
    if (value > 0) video.volume = value / 100;
  }

  function changeRate(value: number) {
    if (video) video.defaultPlaybackRate = video.playbackRate = value;
  }

  function toggleEnhancement() {
    setEnhancementNotice(undefined);
    setEnhanced(!enhanced);
  }

  const canSeek = ready && duration > 0 && !mediaError;
  function seekTo(position: number) {
    if (!video || !canSeek) return;
    video.currentTime = Math.max(0, Math.min(duration, position));
    setTime(video.currentTime);
    setScrubbing(undefined);
  }

  function seekBy(offset: number) {
    if (video) seekTo(video.currentTime + offset);
  }

  return {
    rootRef, videoRef, canvasRef, stream, options,
    ready, waiting, playing, time, displayTime: scrubbing ?? time, duration, volume, muted, rate,
    canSeek, canFullscreen, fullscreen, canPiP, pictureInPicture, enhanced,
    canRetry480: !!(mediaError && stream && Number(stream.value) > 480 &&
      options.some((option) => option.value === '480' && option.url !== stream.url)),
    mediaError, playNotice, modeNotice, enhancementNotice,
    retry: () => setAttempt((value) => value + 1),
    togglePlayback, toggleMute, toggleFullscreen, togglePictureInPicture, toggleEnhancement,
    seekTo, seekBy, setScrubbing, changeQuality, changeVolume, changeRate,
    videoEvents: {
      onWaiting: () => setWaiting(true),
      onPlaying: () => setWaiting(false),
      onRateChange: ({ currentTarget }: VideoEvent) => setRate(currentTarget.playbackRate),
      onTimeUpdate: ({ currentTarget }: VideoEvent) => setTime(currentTarget.currentTime),
      onDurationChange: ({ currentTarget }: VideoEvent) => setDuration(mediaDuration(currentTarget)),
      onPlay: readPlaying,
      onPause: readPlaying,
      onEnded: readPlaying,
      onVolumeChange: ({ currentTarget }: VideoEvent) => {
        setVolume(currentTarget.volume);
        setMuted(currentTarget.muted);
      },
    },
  };
}
