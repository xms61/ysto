// The host's lobby settings (docs/product-specs/settings.md). Every change goes out whole, and choices the
// server would refuse (no formats at all, a year range backwards) can't be made here.
import type { InputHTMLAttributes, ReactNode } from 'react';
import { POINTS, SCORING_MODES, SCORING_PRESETS } from '../../shared/scoring.ts';
import type { ScoringMode, ScoringPreset, ScoringRules } from '../../shared/scoring.ts';
import { DIFFICULTIES, LIMITS, MEDIA_FORMATS, SAMPLE_STARTS, THEME_KINDS } from '../../shared/settings.ts';
import type { Difficulty, LobbySettings, SampleStart, SettingsBounds } from '../../shared/settings.ts';
import { NumberField } from './NumberField.tsx';
import { INPUT } from './ui.tsx';

export const PRESET_NAMES = ['classic', 'buzzer', 'chill'] as const satisfies readonly ScoringPreset[];

export const PRESET_LABELS: Record<ScoringPreset, string> = { classic: 'Classic', buzzer: 'Buzzer', chill: 'Chill' };

export const MODE_LABELS: Record<ScoringMode, string> = {
  speed: 'Speed',
  firstCorrect: 'First correct',
  flat: 'Flat',
};

// What the chosen preset or mode means, under the presets, while the rules themselves stay folded away.
const SCORING_SUMMARY: Record<ScoringMode, string> = {
  speed: 'Faster right answers score more. Change the rules under Adjust.',
  firstCorrect: 'Only the fastest right answer scores. Change the rules under Adjust.',
  flat: 'Every right answer scores the same. Change the rules under Adjust.',
};

const MODE_HINTS: Record<ScoringMode, string> = {
  speed: 'faster right answers score more',
  firstCorrect: 'only the fastest right answer scores',
  flat: 'every right answer scores the same',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  custom: 'Custom popularity range',
};

export const SAMPLE_START_LABELS: Record<SampleStart, string> = {
  random: 'A random part of the song',
  intro: 'The start of the song',
};

const { min: LENGTH_MIN, max: LENGTH_MAX, step: LENGTH_STEP } = LIMITS.sampleLengthSec;
const SAMPLE_LENGTHS = Array.from(
  { length: (LENGTH_MAX - LENGTH_MIN) / LENGTH_STEP + 1 },
  (_, index) => LENGTH_MIN + index * LENGTH_STEP,
);

export function presetOf(scoring: ScoringRules): ScoringPreset | null {
  const matches = (rules: ScoringRules) =>
    rules.mode === scoring.mode &&
    rules.streakBonus === scoring.streakBonus &&
    rules.comeback === scoring.comeback &&
    rules.wrongAnswerPenalty === scoring.wrongAnswerPenalty;
  return PRESET_NAMES.find((name) => matches(SCORING_PRESETS[name])) ?? null;
}

// Adds or removes a value, keeping the list in its canonical order.
function toggled<T extends string>(list: readonly T[], value: T, order: readonly T[]): T[] {
  const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  return order.filter((item) => next.includes(item));
}

function yearOptions(bounds: SettingsBounds): number[] {
  return Array.from({ length: bounds.years.to - bounds.years.from + 1 }, (_, index) => bounds.years.from + index);
}

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-semibold">{legend}</legend>
      {children}
    </fieldset>
  );
}

function Choice({ children, ...input }: { children: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex items-center gap-2">
      <input className="choice" {...input} />
      <span>{children}</span>
    </label>
  );
}

function YearSelect({
  label,
  value,
  years,
  onPick,
}: {
  label: string;
  value: number;
  years: number[];
  onPick: (year: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      {label}
      <select className={INPUT} value={value} onChange={(event) => onPick(Number(event.target.value))}>
        {years.map((year) => (
          <option key={year}>{year}</option>
        ))}
      </select>
    </label>
  );
}

interface SettingsFormProps {
  settings: LobbySettings;
  bounds: SettingsBounds;
  onChange: (settings: LobbySettings) => void;
}

export function SettingsForm({ settings, bounds, onChange }: SettingsFormProps) {
  const set = (change: Partial<LobbySettings>) => onChange({ ...settings, ...change });
  const setScoring = (change: Partial<ScoringRules>) => set({ scoring: { ...settings.scoring, ...change } });
  const preset = presetOf(settings.scoring);
  const years = yearOptions(bounds);
  const { popularityRanks: ranks, years: range } = settings;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Songs per game"
          value={settings.songsPerGame}
          min={LIMITS.songsPerGame.min}
          max={LIMITS.songsPerGame.max}
          onCommit={(songsPerGame) => set({ songsPerGame })}
        />
        <label className="flex flex-col gap-1.5 font-medium">
          Sample length
          <select
            className={INPUT}
            value={settings.sampleLengthSec}
            onChange={(event) => set({ sampleLengthSec: Number(event.target.value) })}
          >
            {SAMPLE_LENGTHS.map((length) => (
              <option key={length} value={length}>
                {length} s
              </option>
            ))}
          </select>
        </label>
      </div>

      <Group legend="Difficulty">
        {DIFFICULTIES.map((difficulty) => (
          <Choice
            key={difficulty}
            type="radio"
            name="difficulty"
            checked={settings.difficulty === difficulty}
            onChange={() => set({ difficulty })}
          >
            {DIFFICULTY_LABELS[difficulty]}
          </Choice>
        ))}
        {settings.difficulty === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Most popular rank"
              value={ranks.from}
              min={1}
              max={bounds.maxRank}
              onCommit={(from) => set({ popularityRanks: { from, to: Math.max(from, ranks.to) } })}
            />
            <NumberField
              label="Least popular rank"
              value={ranks.to}
              min={1}
              max={bounds.maxRank}
              onCommit={(to) => set({ popularityRanks: { from: Math.min(ranks.from, to), to } })}
            />
          </div>
        )}
      </Group>

      <Group legend="Scoring">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {PRESET_NAMES.map((name) => (
            <Choice
              key={name}
              type="radio"
              name="preset"
              checked={preset === name}
              onChange={() => set({ scoring: { ...SCORING_PRESETS[name] } })}
            >
              {PRESET_LABELS[name]}
            </Choice>
          ))}
        </div>
        <p className="text-sm text-muted">{SCORING_SUMMARY[settings.scoring.mode]}</p>
      </Group>

      <details className="adjust">
        <summary className="adjust-summary">Adjust the song pool and scoring rules</summary>
        <div className="mt-5 flex flex-col gap-6">
          <Group legend="Samples start at">
            {SAMPLE_STARTS.map((sampleStart) => (
              <Choice
                key={sampleStart}
                type="radio"
                name="sample-start"
                checked={settings.sampleStart === sampleStart}
                onChange={() => set({ sampleStart })}
              >
                {SAMPLE_START_LABELS[sampleStart]}
              </Choice>
            ))}
          </Group>

          <Group legend="Songs">
            {THEME_KINDS.map((kind) => {
              const checked = settings.kinds.includes(kind);
              return (
                <Choice
                  key={kind}
                  type="checkbox"
                  checked={checked}
                  disabled={checked && settings.kinds.length === 1}
                  onChange={() => set({ kinds: toggled(settings.kinds, kind, THEME_KINDS) })}
                >
                  {kind === 'OP' ? 'Openings' : 'Endings'}
                </Choice>
              );
            })}
          </Group>

          <Group legend="Years">
            <div className="grid grid-cols-2 gap-3">
              <YearSelect
                label="From"
                value={range.from}
                years={years}
                onPick={(from) => set({ years: { from, to: Math.max(from, range.to) } })}
              />
              <YearSelect
                label="To"
                value={range.to}
                years={years}
                onPick={(to) => set({ years: { from: Math.min(range.from, to), to } })}
              />
            </div>
          </Group>

          <Group legend="Formats">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {MEDIA_FORMATS.map((format) => {
                const checked = settings.formats.includes(format);
                return (
                  <Choice
                    key={format}
                    type="checkbox"
                    checked={checked}
                    disabled={checked && settings.formats.length === 1}
                    onChange={() => set({ formats: toggled(settings.formats, format, MEDIA_FORMATS) })}
                  >
                    {format}
                  </Choice>
                );
              })}
            </div>
          </Group>

          {bounds.genres.length > 0 && (
            <Group legend="Genres (none picked means any)">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {bounds.genres.map((genre) => (
                  <Choice
                    key={genre}
                    type="checkbox"
                    checked={settings.genres.includes(genre)}
                    onChange={() => set({ genres: toggled(settings.genres, genre, bounds.genres) })}
                  >
                    {genre}
                  </Choice>
                ))}
              </div>
            </Group>
          )}

          <Group legend="Scoring rules">
            {SCORING_MODES.map((mode) => (
              <Choice
                key={mode}
                type="radio"
                name="mode"
                checked={settings.scoring.mode === mode}
                onChange={() => setScoring({ mode })}
              >
                {MODE_LABELS[mode]}: {MODE_HINTS[mode]}
              </Choice>
            ))}
            <Choice
              type="checkbox"
              checked={settings.scoring.streakBonus}
              onChange={(event) => setScoring({ streakBonus: event.target.checked })}
            >
              Streak bonus: +{POINTS.streakStep} for each right answer in a row
            </Choice>
            <Choice
              type="checkbox"
              checked={settings.scoring.comeback}
              onChange={(event) => setScoring({ comeback: event.target.checked })}
            >
              Comeback: double streak bonus while behind the leader
            </Choice>
            <Choice
              type="checkbox"
              checked={settings.scoring.wrongAnswerPenalty}
              onChange={(event) => setScoring({ wrongAnswerPenalty: event.target.checked })}
            >
              Wrong answers cost {POINTS.penalty} points ({POINTS.firstCorrectPenalty} in First correct)
            </Choice>
          </Group>
        </div>
      </details>
    </div>
  );
}
