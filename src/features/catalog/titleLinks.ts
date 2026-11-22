export function titleHref(sourceKey: string, alias: string): string {
  return `/anime/${encodeURIComponent(sourceKey)}/${encodeURIComponent(alias)}`;
}

export function episodeQuery(episodeId: string, voice: string | null = null): string {
  const params = new URLSearchParams({ episode: episodeId });
  if (voice) params.set('voice', voice);
  return `?${params}`;
}
