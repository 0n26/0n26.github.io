import { useMantineColorScheme } from '@mantine/core';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type ThemeMode = 'dark' | 'light';
export type PaletteId = 'twilight' | 'ember' | 'forest' | 'ocean' | 'custom';

export interface Appearance {
  mode: ThemeMode;
  palette: PaletteId;
  accent: string;
  background: string;
}

interface Palette {
  name: string;
  accent: string;
  dark: string;
  light: string;
}

export const palettes: Record<Exclude<PaletteId, 'custom'>, Palette> = {
  twilight: { name: 'Сумерки', accent: '#7cc4f0', dark: '#101c28', light: '#f2f6fa' },
  ember: { name: 'Уголь', accent: '#f0a76b', dark: '#1b1719', light: '#faf3ee' },
  forest: { name: 'Лес', accent: '#83c9a6', dark: '#101e1a', light: '#f1f7f3' },
  ocean: { name: 'Океан', accent: '#6fb9d6', dark: '#0d1d2b', light: '#eff7fb' },
};

const defaults: Appearance = {
  mode: 'dark',
  palette: 'twilight',
  accent: palettes.twilight.accent,
  background: palettes.twilight.dark,
};

const storageKey = 'night-session:appearance';

function isHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

export function loadAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return defaults;
    const data = value as Partial<Appearance>;
    const mode = data.mode === 'light' ? 'light' : 'dark';
    const palette = data.palette && (data.palette === 'custom' || data.palette in palettes)
      ? data.palette : 'twilight';
    return {
      mode,
      palette,
      accent: isHex(data.accent) ? data.accent : defaults.accent,
      background: isHex(data.background) ? data.background : palette === 'custom' ? defaults.background : palettes[palette as Exclude<PaletteId, 'custom'>][mode],
    };
  } catch {
    return defaults;
  }
}

/** Яркий фон автоматически означает светлую тему — текст остаётся читаемым. */
export function suggestMode(hex: string): ThemeMode {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.32 ? 'light' : 'dark';
}

export function applyAppearance(settings: Appearance): void {
  const root = document.documentElement;
  root.dataset.appTheme = settings.mode;
  root.style.setProperty('--app-accent', settings.accent);
  root.style.setProperty('--app-bg', settings.background);
}

interface AppearanceContextValue {
  settings: Appearance;
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: Exclude<PaletteId, 'custom'>) => void;
  setAccent: (accent: string) => void;
  setBackground: (background: string) => void;
  reset: () => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Appearance>(loadAppearance);
  const { setColorScheme } = useMantineColorScheme();

  useEffect(() => {
    applyAppearance(settings);
    setColorScheme(settings.mode);
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {
      // Приватный режим: оформление работает в рамках сессии.
    }
  }, [settings, setColorScheme]);

  const value = useMemo<AppearanceContextValue>(() => ({
    settings,
    setMode: (mode) => setSettings((current) => ({
      ...current, mode,
      palette: current.palette === 'custom' ? 'custom' : current.palette,
      background: current.palette === 'custom' ? current.background
        : palettes[current.palette as Exclude<PaletteId, 'custom'>][mode],
    })),
    setPalette: (palette) => setSettings((current) => ({
      ...current,
      palette,
      accent: palettes[palette].accent,
      background: palettes[palette][current.mode],
    })),
    setAccent: (accent) => setSettings((current) => ({ ...current, palette: 'custom', accent })),
    setBackground: (background) => setSettings((current) => ({
      ...current, palette: 'custom', background, mode: suggestMode(background),
    })),
    reset: () => setSettings(defaults),
  }), [settings]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('useAppearance must be used inside AppearanceProvider');
  return context;
}
