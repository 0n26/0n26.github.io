import { ActionIcon, Alert, Button, Group, Loader, NativeSelect, Paper, Popover, Slider, Stack, Text, VisuallyHidden } from '@mantine/core';
import { useId } from 'react';
import type { KeyboardEvent } from 'react';
import { PlayerIcon } from './PlayerIcon';
import classes from './Player.module.css';
import { usePlayerMedia } from './usePlayerMedia';

type PlayerProps = {
  episodeKey: string;
  streams: readonly { quality: number; url: string }[];
  poster?: string;
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

export function Player({ episodeKey, streams, poster }: PlayerProps) {
  const shortcutId = useId();
  const {
    rootRef, videoRef, canvasRef, stream, options,
    ready, waiting, playing, time, displayTime, duration, volume, muted, rate,
    canSeek, canFullscreen, fullscreen, canPiP, pictureInPicture, enhanced, canRetry480,
    mediaError, playNotice, modeNotice, enhancementNotice,
    retry, togglePlayback, toggleMute, toggleFullscreen, togglePictureInPicture, toggleEnhancement,
    seekTo, seekBy, setScrubbing, changeQuality, changeVolume, changeRate, videoEvents,
  } = usePlayerMedia(episodeKey, streams);

  function toggleFromStage() {
    rootRef.current?.focus({ preventScroll: true });
    togglePlayback();
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
          {...videoEvents}
        />
        {/* AniLiberty thumbnails do not share the video CDN's CORS policy. */}
        {poster && !playing && (!ready || time === 0) && <img className={classes.poster} src={poster} alt="" />}
        {enhanced && !mediaError && <canvas key={stream.url} ref={canvasRef} className={classes.canvas} aria-hidden="true" hidden />}
        {mediaError ? (
          <div className={classes.error}>
            <Text role="alert" size="sm">{mediaError}</Text>
            <Group gap={6} justify="center">
              <Button size="sm" onClick={() => {
                rootRef.current?.focus({ preventScroll: true });
                retry();
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
            <PlayerIcon name="play" />
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
            value={Math.min(displayTime, duration)}
            max={duration || 1}
            disabled={!canSeek}
            onChange={setScrubbing}
            onChangeEnd={seekTo}
          />
          <Text size="xs" className={classes.clock}>{formatTime(displayTime)} / {formatTime(duration)}</Text>
        </Group>
        <Group gap={0} className={classes.toolbar}>
          <ActionIcon {...control} aria-label={playLabel} title={playLabel}
            disabled={!ready || !!mediaError} onClick={togglePlayback}>
            <PlayerIcon name={playing ? 'pause' : 'play'} />
          </ActionIcon>
          <ActionIcon {...control} aria-label="Назад на 10 секунд" title="Назад на 10 секунд"
            disabled={!canSeek} onClick={() => seekBy(-10)}>
            <PlayerIcon name="rewind" />
          </ActionIcon>
          <ActionIcon {...control} aria-label="Вперёд на 10 секунд" title="Вперёд на 10 секунд"
            disabled={!canSeek} onClick={() => seekBy(10)}>
            <PlayerIcon name="forward" />
          </ActionIcon>
          <ActionIcon {...control} aria-label={soundLabel} title={soundLabel} onClick={toggleMute}>
            <PlayerIcon name={muted ? 'muted' : 'sound'} />
          </ActionIcon>
          <Slider
            className={classes.volume}
            size="xs"
            label={(value) => `${value}%`}
            thumbLabel="Громкость"
            thumbValueText={(value) => `${value}%`}
            value={muted ? 0 : Math.round(volume * 100)}
            onChange={changeVolume}
          />
          <Popover position="top-end" width={232} withinPortal={false} trapFocus returnFocus shadow="md"
            middlewares={{ flip: false, shift: true }}>
            <Popover.Target>
              <ActionIcon {...control} className={`${classes.control} ${classes.settings}`} aria-label="Настройки" title="Настройки">
                <PlayerIcon name="settings" />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown className={classes.settingsPanel} aria-label="Настройки воспроизведения">
              <Stack gap={6}>
                <NativeSelect className={classes.setting} size="sm" label="Качество" aria-label="Качество видео"
                  data={options} value={stream.value}
                  disabled={options.length < 2} onChange={(event) => changeQuality(event.currentTarget.value)} />
                <NativeSelect className={classes.setting} size="sm" label="Скорость" aria-label="Скорость воспроизведения"
                  data={speeds} value={String(rate)}
                  onChange={(event) => changeRate(Number(event.currentTarget.value))} />
                <Button size="sm" variant={enhanced ? 'light' : 'default'}
                  aria-label="Улучшение Anime4K" aria-pressed={enhanced} disabled={!!mediaError}
                  onClick={toggleEnhancement}>
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
              <PlayerIcon name={fullscreen ? 'collapse' : 'expand'} />
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
