export interface TitleRef {
  sourceKey: string;
  alias: string;
}

export const catalogSourceKey = 'combined';

export function qualifyTitle(sourceKey: string, alias: string): string {
  return `${sourceKey}:${alias}`;
}

export function parseVoiceAlias(alias: string): TitleRef | undefined {
  const separator = alias.indexOf(':');
  if (separator <= 0 || separator === alias.length - 1) return;
  const sourceKey = alias.slice(0, separator);
  if (sourceKey !== 'group') return { sourceKey, alias: alias.slice(separator + 1) };
}

export function catalogTitleAlias(alias: string): string {
  // Published links used group:<source>~<alias>|... before the index stored qualified aliases.
  if (!alias.startsWith('group:')) return alias;
  const primary = alias.slice('group:'.length).split('|', 1)[0];
  return primary.replace('~', ':');
}

export function episodePlaybackKey({ sourceKey, alias }: TitleRef, episodeId: string): string {
  return JSON.stringify([sourceKey, alias, episodeId]);
}
