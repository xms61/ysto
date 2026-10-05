// This device's settings: volume, theme, title language and motion (docs/product-specs/settings.md). They
// apply at once and stay on this device. PreferencesMenu puts them behind a button on every screen.
import { useEffect, useRef, useState } from 'react';
import { TITLE_LANGUAGES } from '../../shared/settings.ts';
import type { TitleLanguage } from '../../shared/settings.ts';
import { MOTIONS } from '../prefs/prefs.ts';
import type { Motion, Prefs, Theme } from '../prefs/prefs.ts';
import { THEME_NAMES } from '../themes/names.ts';
import { ThemeSheet } from './ThemeSheet.tsx';
import { INPUT, buttonClass } from './ui.tsx';

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

// The current theme as one row: its swatch in its own colors and its name; it opens the picker.
function ThemeRow({ theme, onChoose }: { theme: Theme; onChoose: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0">Theme</span>
      <button
        type="button"
        data-theme={theme}
        className={`${buttonClass('quiet')} theme-row flex-1`}
        onClick={onChoose}
      >
        <span aria-hidden="true" className="theme-swatch" />
        <span className="display">{THEME_NAMES[theme]}</span>
        <span className="sr-only">, choose a world</span>
      </button>
    </div>
  );
}

interface PrefsPanelProps {
  prefs: Prefs;
  onChange: (change: Partial<Prefs>) => void;
  onChooseTheme: () => void;
}

export function PrefsPanel({ prefs, onChange, onChooseTheme }: PrefsPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <VolumeSlider volume={prefs.volume} onChange={(volume) => onChange({ volume })} />
      <ThemeRow theme={prefs.theme} onChoose={onChooseTheme} />
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
  const [choosing, setChoosing] = useState(false);
  const chooseTheme = () => {
    if (menu.current) menu.current.open = false;
    setChoosing(true);
  };
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
        <PrefsPanel prefs={prefs} onChange={onChange} onChooseTheme={chooseTheme} />
      </div>
      {choosing && (
        <ThemeSheet current={prefs.theme} onUse={(theme) => onChange({ theme })} onClose={() => setChoosing(false)} />
      )}
    </details>
  );
}
