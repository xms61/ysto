// A player's device settings (docs/product-specs/settings.md): volume, theme and title language. They live
// in this browser's localStorage and never reach the server or the other players.
import { useEffect, useLayoutEffect, useState } from 'react';
import { TITLE_LANGUAGES } from '../../shared/settings.ts';
import type { TitleLanguage } from '../../shared/settings.ts';
import { isIntegerIn, isOneOf, isRecord } from '../../shared/validate.ts';
import { readJson, writeItem } from '../storage.ts';

export const THEMES = ['tokyo-rain', 'sakura', 'shonen'] as const;
export type Theme = (typeof THEMES)[number];

export interface Prefs {
  volume: number; // percent, 0–100
  theme: Theme;
  titleLanguage: TitleLanguage;
}

export const DEFAULT_PREFS: Prefs = { volume: 15, theme: 'tokyo-rain', titleLanguage: 'english' };

// Released storage keys are permanent: renaming one resets every player's settings.
const PREFS_KEY = 'ysto_prefs';

// Each field falls back to its default on its own, so one bad value never resets the others.
export function readPrefs(storage: Storage | null): Prefs {
  const stored = readJson(storage, PREFS_KEY);
  const value = isRecord(stored) ? stored : {};
  return {
    volume: isIntegerIn(value.volume, 0, 100) ? value.volume : DEFAULT_PREFS.volume,
    theme: isOneOf(value.theme, THEMES) ? value.theme : DEFAULT_PREFS.theme,
    titleLanguage: isOneOf(value.titleLanguage, TITLE_LANGUAGES) ? value.titleLanguage : DEFAULT_PREFS.titleLanguage,
  };
}

export function writePrefs(storage: Storage | null, prefs: Prefs): void {
  writeItem(storage, PREFS_KEY, JSON.stringify(prefs));
}

// The prefs, saved whenever they change. The theme lands on <html> before the first paint, so a Sakura
// player never sees a flash of the default theme.
export function usePrefs(storage: Storage | null): [Prefs, (change: Partial<Prefs>) => void] {
  const [prefs, setPrefs] = useState(() => readPrefs(storage));
  useEffect(() => {
    writePrefs(storage, prefs);
  }, [storage, prefs]);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
  }, [prefs.theme]);
  const update = (change: Partial<Prefs>) => setPrefs((current) => ({ ...current, ...change }));
  return [prefs, update];
}
