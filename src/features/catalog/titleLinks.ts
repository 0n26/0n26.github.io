export function titleHref(sourceKey: string, alias: string): string {
  return `/anime/${encodeURIComponent(sourceKey)}/${encodeURIComponent(alias)}`;
}

export function episodeQuery(episodeId: string, voice: string | null = null): string {
  const params = new URLSearchParams({ episode: episodeId });
  if (voice) params.set('voice', voice);
  return `?${params}`;
}

export function voiceParams(params: URLSearchParams, alias: string): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set('voice', alias);
  next.delete('episode');
  return next;
}
