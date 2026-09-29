// This device's settings: volume, theme and title language (docs/product-specs/settings.md). They apply at
// once and stay on this device.
import { TITLE_LANGUAGES } from '../../shared/settings.ts';
import type { TitleLanguage } from '../../shared/settings.ts';
import { THEMES } from '../prefs/prefs.ts';
import type { Prefs, Theme } from '../prefs/prefs.ts';
import { INPUT } from './ui.tsx';

const THEME_LABELS: Record<Theme, string> = { 'tokyo-rain': 'Tokyo Rain', sakura: 'Sakura', shonen: 'Shonen' };

const LANGUAGE_LABELS: Record<TitleLanguage, string> = {
  english: 'English',
  romaji: 'Romaji',
  japanese: 'Japanese',
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

export function PrefsPanel({ prefs, onChange }: { prefs: Prefs; onChange: (change: Partial<Prefs>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <VolumeSlider volume={prefs.volume} onChange={(volume) => onChange({ volume })} />
      <label className="flex flex-col gap-1.5">
        Theme
        <select
          className={INPUT}
          value={prefs.theme}
          onChange={(event) => {
            const theme = THEMES.find((candidate) => candidate === event.target.value);
            if (theme) onChange({ theme });
          }}
        >
          {THEMES.map((theme) => (
            <option key={theme} value={theme}>
              {THEME_LABELS[theme]}
            </option>
          ))}
        </select>
      </label>
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
    </div>
  );
}
