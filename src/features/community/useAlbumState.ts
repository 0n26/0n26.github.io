import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addCardToAlbum, addCardToNewAlbum, createAlbum, deleteAlbum, removeCardFromAlbum, renameAlbum,
} from './logic';
import { communityRepository } from './repository';
import type { Album } from './types';

const storageKey = (handle: string) => `night-session:albums:${handle}`;

function isAlbum(value: unknown): value is Album {
  if (typeof value !== 'object' || value === null) return false;
  const album = value as Partial<Album>;
  return typeof album.id === 'string' && typeof album.name === 'string'
    && Array.isArray(album.cardIds) && album.cardIds.every((id) => typeof id === 'string');
}

function readAlbums(handle: string, fallback: readonly Album[]): readonly Album[] {
  try {
    const raw = localStorage.getItem(storageKey(handle));
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isAlbum) : fallback;
  } catch {
    return fallback;
  }
}

function newId(): string {
  return `al-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Альбомы пользователя. Пока хранятся в браузере; когда появится API,
 * `communityRepository.saveAlbums` перехватит запись без изменений в UI.
 */
export function useAlbumState(handle: string, initial: readonly Album[]) {
  const [albums, setAlbums] = useState<readonly Album[]>(() => readAlbums(handle, initial));
  const loadedHandle = useRef(handle);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    if (loadedHandle.current !== handle) {
      loadedHandle.current = handle;
      setAlbums(readAlbums(handle, initial));
      return;
    }
    try {
      localStorage.setItem(storageKey(handle), JSON.stringify(albums));
    } catch {
      // Приватный режим: альбомы работают в рамках сессии.
    }
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    void communityRepository.saveAlbums?.(handle, albums, active.signal).catch(() => undefined);
  }, [albums, handle, initial]);

  useEffect(() => () => controller.current?.abort(), []);

  const addCard = useCallback((albumId: string, cardId: string) =>
    setAlbums((current) => addCardToAlbum(current, albumId, cardId)), []);
  const create = useCallback((name: string, cardId?: string) => {
    const id = newId();
    setAlbums((current) => cardId
      ? addCardToNewAlbum(current, id, name, cardId)
      : createAlbum(current, id, name));
    return id;
  }, []);
  const rename = useCallback((albumId: string, name: string) =>
    setAlbums((current) => renameAlbum(current, albumId, name)), []);
  const removeCard = useCallback((albumId: string, cardId: string) =>
    setAlbums((current) => removeCardFromAlbum(current, albumId, cardId)), []);
  const removeAlbum = useCallback((albumId: string) =>
    setAlbums((current) => deleteAlbum(current, albumId)), []);
  const reset = useCallback(() => setAlbums(initial), [initial]);

  return { albums, addCard, create, rename, removeCard, removeAlbum, reset };
}
