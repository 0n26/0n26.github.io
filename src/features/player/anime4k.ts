export function enhanceVideo(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  onFallback: (message: string) => void,
) {
  const controller = new AbortController();
  const { signal } = controller;
  let started = false;
  let bound = false;
  let revealOnFrame: number | undefined;
  let revealOnPaint: number | undefined;

  function hide() {
    if (revealOnFrame !== undefined) video.cancelVideoFrameCallback(revealOnFrame);
    if (revealOnPaint !== undefined) cancelAnimationFrame(revealOnPaint);
    revealOnFrame = revealOnPaint = undefined;
    canvas.hidden = true;
  }

  function stop() {
    controller.abort();
    hide();
  }

  function fail(message = 'Anime4K остановлен. Видео продолжится без улучшения.') {
    if (signal.aborted) return;
    stop();
    onFallback(message);
  }

  if (!navigator.gpu || !video.requestVideoFrameCallback || !video.cancelVideoFrameCallback) {
    fail('Anime4K недоступен в этом браузере.');
    return stop;
  }

  function canPresent() {
    return !video.paused && !video.seeking && video.readyState >= video.HAVE_CURRENT_DATA;
  }

  function showOnFrame() {
    if (!canvas.hidden || revealOnFrame !== undefined || revealOnPaint !== undefined) return;
    // The renderer's premultiplied canvas starts transparent; the video stays underneath it.
    revealOnFrame = video.requestVideoFrameCallback(() => {
      revealOnFrame = undefined;
      revealOnPaint = requestAnimationFrame(() => {
        revealOnPaint = undefined;
        if (!signal.aborted && canPresent()) canvas.hidden = false;
      });
    });
  }

  async function start() {
    try {
      // Load shaders only for an opted-in player that is playing.
      const { CNNx2M, render } = await import('anime4k-webgpu-async');
      if (signal.aborted) return;
      const width = video.videoWidth;
      const height = video.videoHeight;
      canvas.width = width * 2;
      canvas.height = height * 2;
      video.addEventListener('resize', () => {
        if (video.videoWidth !== width || video.videoHeight !== height) fail();
      }, { signal });

      await render({
        video,
        canvas,
        signal,
        pipelineBuilder(device, inputTexture) {
          device.addEventListener('uncapturederror', () => fail(), { signal });
          // A renderer that stops after consecutive frame errors destroys its device too.
          void device.lost.then(() => fail());
          const limit = device.limits.maxTextureDimension2D;
          if (canvas.width > limit || canvas.height > limit) {
            throw new RangeError('Anime4K output exceeds the WebGPU texture limit');
          }
          return new CNNx2M({ device, inputTexture });
        },
      });
      if (signal.aborted) return;
      bound = true;
      if (canPresent()) showOnFrame();
    } catch {
      fail('Не удалось запустить Anime4K. Видео продолжится без улучшения.');
    }
  }

  function resume() {
    if (!canPresent()) return;
    if (bound) showOnFrame();
    else if (!started) {
      started = true;
      void start();
    }
  }

  for (const event of ['pause', 'seeking', 'waiting', 'ended']) {
    video.addEventListener(event, hide, { signal });
  }
  video.addEventListener('playing', resume, { signal });
  video.addEventListener('seeked', resume, { signal });
  resume();
  return stop;
}
