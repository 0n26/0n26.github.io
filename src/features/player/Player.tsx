import { Alert, Button, Group, NativeSelect, Paper, Slider, Stack, Switch, Text } from '@mantine/core';
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
    void attachHls(video, url, signal, pending.current?.time ?? -1, fail);

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

  if (!stream) return <Alert color="yellow">Нет доступных видеопотоков.</Alert>;

  return (
    <Paper ref={rootRef} className={classes.player} withBorder radius="lg" role="region" aria-label="Видеоплеер">
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
      </div>
      <Stack gap="sm" p="sm" role="group" aria-label="Управление воспроизведением">
        <Group gap="sm" wrap="nowrap">
          <Slider
            className={classes.seek}
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
          <Text size="sm" className={classes.clock}>{formatTime(scrubbing ?? time)} / {formatTime(duration)}</Text>
        </Group>
        <Group gap="xs" justify="space-between">
          <Group gap="xs">
            <Button size="compact-sm" disabled={!ready || !!mediaError} onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              if (video.paused || video.ended) startPlayback();
              else video.pause();
            }}>
              {playing ? 'Пауза' : 'Воспроизвести'}
            </Button>
            <Button size="compact-sm" variant="default" onClick={() => {
              const video = videoRef.current;
              if (video) video.muted = !video.muted;
            }}>
              {muted ? 'Включить звук' : 'Выключить звук'}
            </Button>
            <Slider
              className={classes.volume}
              size="sm"
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
          </Group>
          <Group gap="xs">
            <NativeSelect
              size="xs"
              aria-label="Качество видео"
              data={options}
              value={stream.value}
              onChange={(event) => changeQuality(event.currentTarget.value)}
            />
            <Switch
              size="sm"
              label="Улучшение Anime4K"
              checked={enhanced}
              disabled={!!mediaError}
              onChange={(event) => {
                setEnhancementNotice(undefined);
                setEnhanced(event.currentTarget.checked);
              }}
            />
            {canFullscreen && (
              <Button size="compact-sm" variant="default" onClick={() => void toggleFullscreen()}>
                {fullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'}
              </Button>
            )}
          </Group>
        </Group>
        {mediaError && <Alert color="red" role="alert">{mediaError}</Alert>}
        {(playNotice || fullscreenNotice || enhancementNotice) && (
          <Stack gap={2} role="status">
            {playNotice && <Text size="sm" c="dimmed">{playNotice}</Text>}
            {fullscreenNotice && <Text size="sm" c="dimmed">{fullscreenNotice}</Text>}
            {enhancementNotice && <Text size="sm" c="dimmed">{enhancementNotice}</Text>}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
