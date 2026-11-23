import { useCallback, useEffect } from 'react';
import { useHref, useLocation, useSearchParams } from 'react-router';
import type { TitleAccess } from '../../catalog/catalog';
import { parseVoiceAlias } from '../../catalog/titleRef';
import { voiceParams } from './titleLinks';
import { useRequest } from '../../hooks/useRequest';
import { selectWatchEpisode, voiceChoices } from './voiceEpisodes';

export function useTitlePlayback(source: TitleAccess, alias: string) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const href = useHref(location);
  const voice = source.getVoices ? params.get('voice') : null;
  const selectedId = params.get('episode');
  const locator = voice === null || parseVoiceAlias(voice) ? voice ?? alias : null;

  const loadTitle = useCallback(async (signal: AbortSignal) => {
    // Let StrictMode cancel its probe before issuing requests.
    await Promise.resolve();
    return locator === null || signal.aborted ? null : source.getTitle(locator, signal);
  }, [source, locator]);
  const request = useRequest(locator === null ? null : loadTitle);
  const title = request.status === 'ready' ? request.data : null;
  const loadVoices = useCallback(async (signal: AbortSignal) => {
    await Promise.resolve();
    return signal.aborted ? [] : (source.getVoices?.(alias, signal) ?? []);
  }, [source, alias]);
  const voicesRequest = useRequest(source.getVoices ? loadVoices : null);
  const indexedVoices = voicesRequest.status === 'ready' ? voicesRequest.data : undefined;

  const switchFrom = location.state?.voiceEpisodeNumber;
  const pendingNumber = voice !== null && typeof switchFrom === 'number' ? switchFrom : null;
  const currentIndex = title ? selectWatchEpisode(title.episodes, selectedId, pendingNumber, location.state?.voiceEpisodeRange) : -1;
  const episode = title?.episodes[currentIndex];

  useEffect(() => {
    // Back can change the hash before React Router commits the new location.
    if (!episode || pendingNumber === null || window.location.hash !== href) return;
    const next = new URLSearchParams(params);
    next.set('episode', episode.id);
    setParams(next, { replace: true });
  }, [episode, href, params, pendingNumber, setParams]);

  if (locator !== null && request.status === 'loading') return { status: 'loading' } as const;

  if (!title) {
    const alternatives = indexedVoices?.filter((option) => option.alias !== voice);
    const legacyFallback = voice !== null && locator !== null && voice !== alias && parseVoiceAlias(alias)
      && voicesRequest.status !== 'loading' && !alternatives?.length;
    return {
      status: 'unavailable', params, alternatives, legacyFallback,
      error: voice !== null ? 'Выбранная озвучка недоступна'
        : request.status === 'error' ? 'Не удалось загрузить аниме' : undefined,
    } as const;
  }

  const { choices, starts, ordinal, currentVoice } = voiceChoices(title, indexedVoices, currentIndex);
  function changeVoice(nextAlias: string) {
    const target = choices?.find((option) => option.alias === nextAlias);
    if (!target || target === currentVoice) return;
    setParams(voiceParams(params, target.alias), {
      state: { voiceEpisodeNumber: ordinal, voiceEpisodeRange: target.episodeRange },
    });
  }

  return {
    status: 'ready', title, params, voice, currentIndex, episode, selectedId, choices, starts, changeVoice,
    rangeMismatch: pendingNumber !== null && currentIndex < 0,
    rangeChanged: !!(currentVoice?.episodeRange && episode && ordinal === undefined),
  } as const;
}
