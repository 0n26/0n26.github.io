import { ActionIcon, Alert, Button, Group, Loader, NativeSelect, Paper, Popover, Slider, Stack, Text, VisuallyHidden } from '@mantine/core';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { enhanceVideo } from './anime4k';
import { attachHls, mediaDuration, playbackPoint, readPosition, savePosition } from './media';
import type { PlaybackPoint } from './media';
import classes from './Player.module.css';

type PlayerProps = {
  episodeKey: string;
  streams: readonly { quality: number; url: string }[];
  poster?: string;
};

type WebKitVideo = HTMLVideoElement & {
  webkitSupportsFullscreen?: boolean;
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitPresentationMode?: 'inline' | 'fullscreen' | 'picture-in-picture';
  webkitSupportsPresentationMode?: (mode: 'picture-in-picture') => boolean;
  webkitSetPresentationMode?: (mode: 'inline' | 'picture-in-picture') => void;
};

const speeds = ['0.5', '0.75', '1', '1.25', '1.5', '1.75', '2'].map((value) => ({
  value, label: `${value.replace('.', ',')}×`,
}));
const control = { size: 44, variant: 'subtle', className: classes.control };

function formatTime(time: number) {
  const total = Math.floor(time);
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor(total / 60) % 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${minutes.padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

const glyphs = {
  play: 'M7 4 L21 12 L7 20 Z',
  pause: 'M5 4 H9 V20 H5 Z M15 4 H19 V20 H15 Z',
  sound: 'M3 9 H7 L12 5 V19 L7 15 H3 Z M16 8 Q20 12 16 16 M19 5 Q26 12 19 19',
  muted: 'M3 9 H7 L12 5 V19 L7 15 H3 Z M16 9 L22 15 M22 9 L16 15',
  expand: 'M3 9 V3 H9 M15 3 H21 V9 M21 15 V21 H15 M9 21 H3 V15',
  collapse: 'M9 3 V9 H3 M15 3 V9 H21 M21 15 H15 V21 M3 15 H9 V21',
  rewind: 'M3 4 V9 H8 M3 9 A9 9 0 1 1 7 20',
  forward: 'M21 4 V9 H16 M21 9 A9 9 0 1 0 17 20',
  settings: 'M4 6 H20 M4 12 H20 M4 18 H20 M8 4 V8 M16 10 V14 M10 16 V20',
};

function Glyph({ name }: { name: keyof typeof glyphs }) {
  return (
    <svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24"
      fill={name === 'play' || name === 'pause' ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={glyphs[name]} />
      {(name === 'rewind' || name === 'forward') && (
        <text x="12" y="15.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" stroke="none">10</text>
      )}
    </svg>
  );
}

export function Player({ episodeKey, streams, poster }: PlayerProps) {
  const shortcutId = useId();
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

  function readPlaying() {
    const video = videoRef.current;
    if (video) setPlaying(!video.paused && !video.ended);
  }

  function togglePlayback() {
    if (!video || !ready || mediaError) return;
    if (video.paused || video.ended) startPlayback();
    else video.pause();
  }

  function toggleFromStage() {
    rootRef.current?.focus({ preventScroll: true });
    togglePlayback();
  }

  function toggleMute() {
    if (video) video.muted = !video.muted;
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

  function handleShortcut(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const key = event.key.toLowerCase();
    if (key === 'arrowleft' || key === 'arrowright') seekBy(key === 'arrowleft' ? -10 : 10);
    else if (key === ' ' || key === 'k' || key === 'm' || key === 'f') {
      if (!event.repeat) {
        if (key === 'm') toggleMute();
        else if (key === 'f' && canFullscreen) void toggleFullscreen();
        else if (key !== 'f') togglePlayback();
      }
    } else return;
    event.preventDefault();
  }

  if (!stream) return <Alert color="yellow">Нет доступных видеопотоков.</Alert>;
  const canRetry480 = mediaError && Number(stream.value) > 480 &&
    options.some((option) => option.value === '480' && option.url !== stream.url);
  const playLabel = playing ? 'Пауза' : 'Воспроизвести';
  const soundLabel = muted ? 'Включить звук' : 'Выключить звук';
  const fullscreenLabel = fullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран';

  return (
    <Paper ref={rootRef} className={classes.player} data-playing={playing || undefined}
      withBorder radius="lg" role="region" aria-label="Видеоплеер" aria-describedby={shortcutId}
      tabIndex={0} onKeyDown={handleShortcut}>
      <VisuallyHidden id={shortcutId}>
        Пробел или K — воспроизведение и пауза. Стрелки влево и вправо — перемотка на 10 секунд.
        M — звук. F — полноэкранный режим.
      </VisuallyHidden>
      <div className={classes.stage}>
        <video
          ref={videoRef}
          className={classes.video}
          aria-label="Видео эпизода"
          crossOrigin="anonymous"
          preload="metadata"
          playsInline
          tabIndex={-1}
          onClick={toggleFromStage}
          onWaiting={() => setWaiting(true)}
          onPlaying={() => setWaiting(false)}
          onRateChange={(event) => setRate(event.currentTarget.playbackRate)}
          onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
          onDurationChange={(event) => setDuration(mediaDuration(event.currentTarget))}
          onPlay={readPlaying}
          onPause={readPlaying}
          onEnded={readPlaying}
          onVolumeChange={(event) => {
            setVolume(event.currentTarget.volume);
            setMuted(event.currentTarget.muted);
          }}
        />
        {/* AniLiberty thumbnails do not share the video CDN's CORS policy. */}
        {poster && !playing && (!ready || time === 0) && <img className={classes.poster} src={poster} alt="" />}
        {enhanced && !mediaError && <canvas key={url} ref={canvasRef} className={classes.canvas} aria-hidden="true" hidden />}
        {mediaError ? (
          <div className={classes.error}>
            <Text role="alert" size="sm">{mediaError}</Text>
            <Group gap={6} justify="center">
              <Button size="sm" onClick={() => {
                rootRef.current?.focus({ preventScroll: true });
                setAttempt(attempt + 1);
              }}>Повторить</Button>
              {canRetry480 && <Button size="sm" variant="default" onClick={() => {
                rootRef.current?.focus({ preventScroll: true });
                changeQuality('480');
              }}>Попробовать 480p</Button>}
            </Group>
          </div>
        ) : !ready || (playing && waiting) ? (
          <div className={classes.feedback} role="status">
            <Loader size="sm" aria-hidden="true" />
            <Text size="sm">{ready ? 'Буферизация…' : 'Загрузка видео…'}</Text>
          </div>
        ) : !playing && (
          <ActionIcon className={classes.centerPlay} size="4rem" radius="50%"
            aria-label="Воспроизвести видео" onClick={toggleFromStage}>
            <Glyph name="play" />
          </ActionIcon>
        )}
      </div>
      <div className={classes.controls} role="group" aria-label="Управление воспроизведением">
        <Group gap="sm" wrap="nowrap">
          <Slider
            className={classes.seek}
            classNames={{ trackContainer: classes.seekTarget }}
            size="xs"
            thumbSize={14}
            thumbLabel="Позиция воспроизведения"
            thumbValueText={formatTime}
            label={formatTime}
            value={Math.min(scrubbing ?? time, duration)}
            max={duration || 1}
            disabled={!canSeek}
            onChange={setScrubbing}
            onChangeEnd={seekTo}
          />
          <Text size="xs" className={classes.clock}>{formatTime(scrubbing ?? time)} / {formatTime(duration)}</Text>
        </Group>
        <Group gap={0} className={classes.toolbar}>
          <ActionIcon {...control} aria-label={playLabel} title={playLabel}
            disabled={!ready || !!mediaError} onClick={togglePlayback}>
            <Glyph name={playing ? 'pause' : 'play'} />
          </ActionIcon>
          <ActionIcon {...control} aria-label="Назад на 10 секунд" title="Назад на 10 секунд"
            disabled={!canSeek} onClick={() => seekBy(-10)}>
            <Glyph name="rewind" />
          </ActionIcon>
          <ActionIcon {...control} aria-label="Вперёд на 10 секунд" title="Вперёд на 10 секунд"
            disabled={!canSeek} onClick={() => seekBy(10)}>
            <Glyph name="forward" />
          </ActionIcon>
          <ActionIcon {...control} aria-label={soundLabel} title={soundLabel} onClick={toggleMute}>
            <Glyph name={muted ? 'muted' : 'sound'} />
          </ActionIcon>
          <Slider
            className={classes.volume}
            size="xs"
            label={(value) => `${value}%`}
            thumbLabel="Громкость"
            thumbValueText={(value) => `${value}%`}
            value={muted ? 0 : Math.round(volume * 100)}
            onChange={(value) => {
              if (!video) return;
              video.muted = value === 0;
              if (value > 0) video.volume = value / 100;
            }}
          />
          <Popover position="top-end" width={232} withinPortal={false} trapFocus returnFocus shadow="md"
            middlewares={{ flip: false, shift: true }}>
            <Popover.Target>
              <ActionIcon {...control} className={`${classes.control} ${classes.settings}`} aria-label="Настройки" title="Настройки">
                <Glyph name="settings" />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown className={classes.settingsPanel} aria-label="Настройки воспроизведения">
              <Stack gap={6}>
                <NativeSelect className={classes.setting} size="sm" label="Качество" aria-label="Качество видео"
                  data={options} value={stream.value}
                  disabled={options.length < 2} onChange={(event) => changeQuality(event.currentTarget.value)} />
                <NativeSelect className={classes.setting} size="sm" label="Скорость" aria-label="Скорость воспроизведения"
                  data={speeds} value={String(rate)}
                  onChange={(event) => {
                    if (video) video.defaultPlaybackRate = video.playbackRate = Number(event.currentTarget.value);
                  }} />
                <Button size="sm" variant={enhanced ? 'light' : 'default'} color="yellow"
                  aria-label="Улучшение Anime4K" aria-pressed={enhanced} disabled={!!mediaError}
                  onClick={() => {
                    setEnhancementNotice(undefined);
                    setEnhanced(!enhanced);
                  }}>
                  Anime4K
                </Button>
                {canPiP && (
                  <Button size="sm" variant="default" aria-pressed={pictureInPicture}
                    onClick={() => void togglePictureInPicture()}>Картинка в картинке</Button>
                )}
              </Stack>
            </Popover.Dropdown>
          </Popover>
          {canFullscreen && (
            <ActionIcon {...control} aria-label={fullscreenLabel} title={fullscreenLabel}
              onClick={() => void toggleFullscreen()}>
              <Glyph name={fullscreen ? 'collapse' : 'expand'} />
            </ActionIcon>
          )}
        </Group>
      </div>
      {(playNotice || modeNotice || enhancementNotice) && (
        <Stack gap={2} p="xs" role="status">
          {playNotice && <Text size="sm">{playNotice}</Text>}
          {modeNotice && <Text size="sm">{modeNotice}</Text>}
          {enhancementNotice && <Text size="sm">{enhancementNotice}</Text>}
        </Stack>
      )}
    </Paper>
  );
}
