import { ActionIcon, Alert, Button, Group, NativeSelect, Paper, Slider, Stack, Text } from '@mantine/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { enhanceVideo } from './anime4k';
import { attachHls, mediaDuration, playbackPoint } from './media';
import type { PlaybackPoint } from './media';
import classes from './Player.module.css';

type PlayerProps = {
  streams: readonly { quality: number; url: string }[];
  poster?: string;
};

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
};

function Glyph({ name }: { name: keyof typeof glyphs }) {
  return (
    <svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24"
      fill={name === 'play' || name === 'pause' ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={glyphs[name]} />
    </svg>
  );
}

export function Player({ streams, poster }: PlayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pending = useRef<PlaybackPoint | undefined>(undefined);
  const mediaSignal = useRef<AbortSignal | undefined>(undefined);

  const options = useMemo(() => [...streams].sort((a, b) => b.quality - a.quality).map(({ quality, url }) => ({
    url, value: String(quality), label: `${quality}p`,
  })), [streams]);
  const [quality, setQuality] = useState<string>();
  const stream = options.find(({ value }) => value === quality) ?? options[0];
  const url = stream?.url;

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrubbing, setScrubbing] = useState<number>();
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [mediaError, setMediaError] = useState<string>();
  const [playNotice, setPlayNotice] = useState<string>();
  const [fullscreenNotice, setFullscreenNotice] = useState<string>();
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
    setPlaying(false);
    setTime(pending.current?.time ?? 0);
    setDuration(0);
    setScrubbing(undefined);
    setMediaError(undefined);
    setPlayNotice(undefined);

    const fail = (message: string) => {
      // Aborting HLS detaches the media before the viewer can choose another quality.
      pending.current = playbackPoint(video, pending.current);
      controller.abort();
      video.pause();
      setMediaError(message);
    };
    video.addEventListener('error', () => fail('Не удалось воспроизвести видео.'), { signal });
    video.addEventListener('loadedmetadata', () => {
      const saved = pending.current;
      const length = mediaDuration(video);
      if (saved) {
        pending.current = undefined;
        video.currentTime = Math.min(saved.time, length || saved.time);
      }
      setDuration(length);
      setTime(video.currentTime);
      setReady(true);
      if (saved?.playing) startPlayback();
    }, { signal, once: true });
    if (new URL(url).pathname.toLowerCase().endsWith('.mp4')) video.src = url;
    else void attachHls(video, url, signal, pending.current?.time ?? -1, fail);

    return () => {
      controller.abort();
      video.removeAttribute('src');
      video.load();
    };
  }, [url, startPlayback]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!enhanced || mediaError || !video || !canvas) return;
    return enhanceVideo(video, canvas, (message) => {
      setEnhanced(false);
      setEnhancementNotice(message);
    });
  }, [enhanced, mediaError, url]);

  const canFullscreen = document.fullscreenEnabled;
  useEffect(() => {
    if (!canFullscreen) return;
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [canFullscreen]);

  async function toggleFullscreen() {
    const root = rootRef.current;
    if (!root) return;
    setFullscreenNotice(undefined);
    try {
      if (document.fullscreenElement === root) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch {
      setFullscreenNotice('Не удалось переключить полноэкранный режим.');
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
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) startPlayback();
    else video.pause();
  }

  if (!stream) return <Alert color="yellow">Нет доступных видеопотоков.</Alert>;
  const canRetry480 = mediaError && Number(stream.value) > 480 &&
    options.some((option) => option.value === '480' && option.url !== stream.url);
  const playLabel = playing ? 'Пауза' : 'Воспроизвести';
  const soundLabel = muted ? 'Включить звук' : 'Выключить звук';
  const fullscreenLabel = fullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран';

  return (
    <Paper ref={rootRef} className={classes.player} data-playing={playing || undefined}
      withBorder radius="lg" role="region" aria-label="Видеоплеер">
      <div className={classes.stage}>
        <video
          ref={videoRef}
          className={classes.video}
          aria-label="Видео эпизода"
          crossOrigin="anonymous"
          preload="metadata"
          playsInline
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
        {poster && !playing && time === 0 && <img className={classes.poster} src={poster} alt="" />}
        {enhanced && !mediaError && <canvas key={url} ref={canvasRef} className={classes.canvas} aria-hidden="true" hidden />}
        {mediaError ? (
          <div className={classes.error}>
            <Text role="alert" size="sm">{mediaError}</Text>
            {canRetry480 && <Button size="xs" onClick={() => changeQuality('480')}>Попробовать 480p</Button>}
          </div>
        ) : !playing && (
          <ActionIcon className={classes.centerPlay} size="4rem" radius="50%" disabled={!ready}
            aria-label="Воспроизвести видео" onClick={togglePlayback}>
            <Glyph name="play" />
          </ActionIcon>
        )}
      </div>
      <div className={classes.controls} role="group" aria-label="Управление воспроизведением">
        <Group gap="sm" wrap="nowrap">
          <Slider
            className={classes.seek}
            size="xs"
            thumbLabel="Позиция воспроизведения"
            thumbValueText={formatTime}
            label={formatTime}
            value={scrubbing ?? time}
            max={duration || 1}
            disabled={!ready || !duration || !!mediaError}
            onChange={setScrubbing}
            onChangeEnd={(value) => {
              const video = videoRef.current;
              if (!video) return;
              video.currentTime = value;
              setTime(video.currentTime);
              setScrubbing(undefined);
            }}
          />
          <Text size="xs" className={classes.clock}>{formatTime(scrubbing ?? time)} / {formatTime(duration)}</Text>
        </Group>
        <Group gap={4} className={classes.toolbar}>
          <ActionIcon size="lg" variant="subtle" color="gray" aria-label={playLabel} title={playLabel}
            disabled={!ready || !!mediaError} onClick={togglePlayback}>
            <Glyph name={playing ? 'pause' : 'play'} />
          </ActionIcon>
          <ActionIcon size="lg" variant="subtle" color="gray" aria-label={soundLabel} title={soundLabel}
            onClick={() => {
              const video = videoRef.current;
              if (video) video.muted = !video.muted;
            }}>
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
              const video = videoRef.current;
              if (!video) return;
              video.muted = value === 0;
              if (value > 0) video.volume = value / 100;
            }}
          />
          <NativeSelect
            className={classes.quality}
            size="xs"
            aria-label="Качество видео"
            data={options}
            value={stream.value}
            onChange={(event) => changeQuality(event.currentTarget.value)}
          />
          <Button size="xs" variant={enhanced ? 'light' : 'subtle'} color={enhanced ? 'yellow' : 'gray'}
            aria-label="Улучшение Anime4K" aria-pressed={enhanced} disabled={!!mediaError}
            onClick={() => {
              setEnhancementNotice(undefined);
              setEnhanced(!enhanced);
            }}>
            Anime4K
          </Button>
          {canFullscreen && (
            <ActionIcon size="lg" variant="subtle" color="gray" aria-label={fullscreenLabel} title={fullscreenLabel}
              onClick={() => void toggleFullscreen()}>
              <Glyph name={fullscreen ? 'collapse' : 'expand'} />
            </ActionIcon>
          )}
        </Group>
      </div>
      {(playNotice || fullscreenNotice || enhancementNotice) && (
        <Stack gap={2} p="xs" role="status">
          {playNotice && <Text size="sm">{playNotice}</Text>}
          {fullscreenNotice && <Text size="sm">{fullscreenNotice}</Text>}
          {enhancementNotice && <Text size="sm">{enhancementNotice}</Text>}
        </Stack>
      )}
    </Paper>
  );
}
