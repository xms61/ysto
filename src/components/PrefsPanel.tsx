// This device's settings: volume, theme, title language and motion (docs/product-specs/settings.md). They
// apply at once and stay on this device. PreferencesMenu puts them behind a button on every screen.
import { TITLE_LANGUAGES } from '../../shared/settings.ts';
import type { TitleLanguage } from '../../shared/settings.ts';
import { MOTIONS, THEMES } from '../prefs/prefs.ts';
import type { Motion, Prefs, Theme } from '../prefs/prefs.ts';
import { INPUT } from './ui.tsx';

const THEME_LABELS: Record<Theme, string> = { 'tokyo-rain': 'Tokyo Rain', sakura: 'Sakura', shonen: 'Shonen' };

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

// Each choice shows its theme in its own colors and type, since a theme block also applies inside another.
function ThemePicker({ theme, onChange }: { theme: Theme; onChange: (theme: Theme) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5">Theme</legend>
      <div className="grid grid-cols-3 gap-2">
        {THEMES.map((option) => (
          <label
            key={option}
            data-theme={option}
            className={
              'panel-shadow flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 bg-panel p-2 text-ink ' +
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
            <span aria-hidden="true" className="flex gap-1">
              <span className="size-3 rounded-full bg-accent" />
              <span className="size-3 rounded-full bg-good" />
              <span className="size-3 rounded-full border border-edge bg-page" />
            </span>
            <span className="display text-sm">{THEME_LABELS[option]}</span>
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

// The settings behind a button, opening over the screen from its top right corner.
export function PreferencesMenu({ prefs, onChange }: { prefs: Prefs; onChange: (change: Partial<Prefs>) => void }) {
  return (
    <details className="ml-auto">
      <summary className="cursor-pointer list-none rounded-lg border border-line bg-raised px-3 py-2 [&::-webkit-details-marker]:hidden">
        Preferences
      </summary>
      <div className="panel-shadow absolute top-full right-0 z-30 mt-2 w-80 max-w-full rounded-2xl border border-line bg-panel p-4">
        <PrefsPanel prefs={prefs} onChange={onChange} />
      </div>
    </details>
  );
}
