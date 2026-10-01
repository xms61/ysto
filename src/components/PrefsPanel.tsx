// This device's settings: volume, theme, title language and motion (docs/product-specs/settings.md). They
// apply at once and stay on this device. PreferencesMenu puts them behind a button on every screen.
import { useEffect, useRef } from 'react';
import { TITLE_LANGUAGES } from '../../shared/settings.ts';
import type { TitleLanguage } from '../../shared/settings.ts';
import { MOTIONS, THEMES } from '../prefs/prefs.ts';
import type { Motion, Prefs, Theme } from '../prefs/prefs.ts';
import { INPUT, buttonClass } from './ui.tsx';

const THEME_LABELS: Record<Theme, string> = {
  'tokyo-rain': 'Tokyo Rain',
  konbini: 'Konbini 2 a.m.',
  karaoke: 'Karaoke Box',
  sakura: 'Hanami',
  omikuji: 'Omikuji',
  'blossom-map': 'Blossom Map',
  shonen: 'Fighter Select',
  'tournament-arc': 'Tournament Arc',
  'splash-page': 'Splash Page',
  'night-arc': 'Night Arc',
  mecha: 'Model Kit',
  'magical-girl': 'Gachapon',
  isekai: 'Quest Board',
  'retro-vhs': 'Back Issue',
  'side-a': 'Side A',
};

const LANGUAGE_LABELS: Record<TitleLanguage, string> = {
  english: 'English',
  romaji: 'Romaji',
  japanese: 'Japanese',
};

const MOTION_LABELS: Record<Motion, string> = {
  system: 'As the device is set',
  reduced: 'Reduced',
  full: 'Full',
};

export function VolumeSlider({ volume, onChange }: { volume: number; onChange: (volume: number) => void }) {
  return (
    <label className="flex items-center gap-3">
      <span className="shrink-0">Volume</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={volume}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full min-w-24"
      />
      <span className="w-10 shrink-0 text-right tabular-nums">{volume}%</span>
    </label>
  );
}

// Each choice previews its theme's card stock in its own colors and type, since a theme block also applies
// inside another.
function ThemePicker({ theme, onChange }: { theme: Theme; onChange: (theme: Theme) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5">Theme</legend>
      <div className="grid grid-cols-2 gap-2">
        {THEMES.map((option) => (
          <label
            key={option}
            data-theme={option}
            className={
              'page-texture flex cursor-pointer items-center gap-2 rounded-xl border-2 p-2 text-ink ' +
              'outline-offset-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ' +
              (option === theme ? 'border-accent' : 'border-line')
            }
          >
            <input
              type="radio"
              name="theme"
              className="sr-only"
              checked={option === theme}
              onChange={() => onChange(option)}
            />
            <span
              aria-hidden="true"
              className="grid h-9 w-7 shrink-0 place-items-start rounded-lg border-2 border-[var(--card-mark)] bg-[var(--card)] p-0.5"
            >
              <span className="size-2.5 rounded-sm bg-[var(--card-mark)]" />
            </span>
            <span className="display text-sm leading-tight">{THEME_LABELS[option]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PrefsPanel({ prefs, onChange }: { prefs: Prefs; onChange: (change: Partial<Prefs>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <VolumeSlider volume={prefs.volume} onChange={(volume) => onChange({ volume })} />
      <ThemePicker theme={prefs.theme} onChange={(theme) => onChange({ theme })} />
      <label className="flex flex-col gap-1.5">
        Anime titles in
        <select
          className={INPUT}
          value={prefs.titleLanguage}
          onChange={(event) => {
            const titleLanguage = TITLE_LANGUAGES.find((candidate) => candidate === event.target.value);
            if (titleLanguage) onChange({ titleLanguage });
          }}
        >
          {TITLE_LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {LANGUAGE_LABELS[language]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        Motion
        <select
          className={INPUT}
          value={prefs.motion}
          onChange={(event) => {
            const motion = MOTIONS.find((candidate) => candidate === event.target.value);
            if (motion) onChange({ motion });
          }}
        >
          {MOTIONS.map((motion) => (
            <option key={motion} value={motion}>
              {MOTION_LABELS[motion]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

// The settings behind a button, opening over the screen from its top right corner. A tap outside or Escape
// closes it, so it never sits over the options for a whole round.
export function PreferencesMenu({ prefs, onChange }: { prefs: Prefs; onChange: (change: Partial<Prefs>) => void }) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: Event) => {
      const details = menu.current;
      if (!details?.open) return;
      const outside = event.target instanceof Node && !details.contains(event.target);
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : outside) {
        details.open = false;
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, []);
  return (
    <details ref={menu} className="ml-auto">
      <summary className={`${buttonClass('quiet')} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        Preferences
      </summary>
      <div className="panel absolute top-full right-0 z-30 mt-2 w-80 max-w-full p-4">
        <PrefsPanel prefs={prefs} onChange={onChange} />
      </div>
    </details>
  );
}
