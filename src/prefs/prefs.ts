// A player's device settings (docs/product-specs/settings.md): volume, theme, title language and motion.
// They live in this browser's localStorage and never reach the server or the other players.
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { TITLE_LANGUAGES } from '../../shared/settings.ts';
import type { TitleLanguage } from '../../shared/settings.ts';
import { isIntegerIn, isOneOf, isRecord } from '../../shared/validate.ts';
import { readJson, writeItem } from '../storage.ts';

export const THEMES = ['tokyo-rain', 'sakura', 'shonen'] as const;
export type Theme = (typeof THEMES)[number];

// 'system' follows the device's reduced-motion setting; the other two override it.
export const MOTIONS = ['system', 'reduced', 'full'] as const;
export type Motion = (typeof MOTIONS)[number];

export interface Prefs {
  volume: number; // percent, 0–100
  theme: Theme;
  titleLanguage: TitleLanguage;
  motion: Motion;
}

export const DEFAULT_PREFS: Prefs = { volume: 15, theme: 'tokyo-rain', titleLanguage: 'english', motion: 'system' };

// Released storage keys are permanent: renaming one resets every player's settings.
const PREFS_KEY = 'ysto_prefs';

// Each field falls back to its default on its own, so one bad value never resets the others, and settings
// saved before a field existed keep working.
export function readPrefs(storage: Storage | null): Prefs {
  const stored = readJson(storage, PREFS_KEY);
  const value = isRecord(stored) ? stored : {};
  return {
    volume: isIntegerIn(value.volume, 0, 100) ? value.volume : DEFAULT_PREFS.volume,
    theme: isOneOf(value.theme, THEMES) ? value.theme : DEFAULT_PREFS.theme,
    titleLanguage: isOneOf(value.titleLanguage, TITLE_LANGUAGES) ? value.titleLanguage : DEFAULT_PREFS.titleLanguage,
    motion: isOneOf(value.motion, MOTIONS) ? value.motion : DEFAULT_PREFS.motion,
  };
}

export function writePrefs(storage: Storage | null, prefs: Prefs): void {
  writeItem(storage, PREFS_KEY, JSON.stringify(prefs));
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeToSystemMotion(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function systemReducesMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

// Whether decoration should hold still: the player's choice, or else the device's setting.
export function useReducedMotion(motion: Motion): boolean {
  const systemReduces = useSyncExternalStore(subscribeToSystemMotion, systemReducesMotion);
  return motion === 'reduced' || (motion === 'system' && systemReduces);
}

// The theme's page color, for the browser's own toolbar on phones.
function syncThemeColor(): void {
  const color = getComputedStyle(document.documentElement).getPropertyValue('--page').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (color && meta) meta.setAttribute('content', color);
}

// The prefs, saved whenever they change. The theme and the motion setting land on <html> before the first
// paint, so a Sakura player never sees a flash of the default theme.
export function usePrefs(storage: Storage | null): {
  prefs: Prefs;
  update: (change: Partial<Prefs>) => void;
  reducedMotion: boolean;
} {
  const [prefs, setPrefs] = useState(() => readPrefs(storage));
  const reducedMotion = useReducedMotion(prefs.motion);
  useEffect(() => {
    writePrefs(storage, prefs);
  }, [storage, prefs]);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    syncThemeColor();
  }, [prefs.theme]);
  useLayoutEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full';
  }, [reducedMotion]);
  const update = (change: Partial<Prefs>) => setPrefs((current) => ({ ...current, ...change }));
  return { prefs, update, reducedMotion };
}
