// The lobby settings in words, for the players who aren't the host.
import { MEDIA_FORMATS, answersCanChange } from '../../shared/settings.ts';
import type { LobbySettings, SettingsBounds } from '../../shared/settings.ts';
import { DIFFICULTY_LABELS, MODE_LABELS, PRESET_LABELS, SAMPLE_START_LABELS, presetOf } from './SettingsForm.tsx';

function difficulty(settings: LobbySettings): string {
  const { difficulty: level, popularityRanks: ranks } = settings;
  return level === 'custom' ? `Popularity ranks ${ranks.from} to ${ranks.to}` : DIFFICULTY_LABELS[level];
}

function songsFrom(settings: LobbySettings, bounds: SettingsBounds): string {
  const kinds =
    settings.kinds.length === 2 ? 'Openings and endings' : settings.kinds[0] === 'OP' ? 'Openings' : 'Endings';
  const { from, to } = settings.years;
  const allYears = from === bounds.years.from && to === bounds.years.to;
  const years = allYears ? 'all years' : from === to ? String(from) : `${from} to ${to}`;
  const formats = settings.formats.length === MEDIA_FORMATS.length ? 'all formats' : settings.formats.join(', ');
  const genres = settings.genres.length === 0 ? 'any genre' : settings.genres.join(', ');
  return `${kinds}, ${years}, ${formats}, ${genres}`;
}

function scoring(settings: LobbySettings): string {
  const { mode, streakBonus, comeback, wrongAnswerPenalty } = settings.scoring;
  const preset = presetOf(settings.scoring);
  const modifiers = [
    streakBonus && 'streak bonus',
    comeback && 'comeback',
    wrongAnswerPenalty && 'wrong answers cost points',
  ].filter((modifier) => modifier !== false);
  const rules = [MODE_LABELS[mode], ...modifiers].join(', ');
  return preset ? `${PRESET_LABELS[preset]} (${rules})` : rules;
}

export function SettingsSummary({ settings, bounds }: { settings: LobbySettings; bounds: SettingsBounds }) {
  const rows: [string, string][] = [
    [
      'Game',
      settings.endless
        ? `Endless, ${settings.sampleLengthSec} s a song`
        : `${settings.songsPerGame} songs, ${settings.sampleLengthSec} s each`,
    ],
    ['Difficulty', difficulty(settings)],
    ['Samples start at', SAMPLE_START_LABELS[settings.sampleStart].toLowerCase()],
    ['Songs', songsFrom(settings, bounds)],
    ['Scoring', scoring(settings)],
    [
      'Answers',
      answersCanChange(settings)
        ? `Can change until the round closes, with ${settings.overtimeSec} s of overtime`
        : 'Locked once picked',
    ],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
      {rows.map(([term, detail]) => (
        <div key={term} className="contents">
          <dt className="text-muted">{term}</dt>
          <dd>{detail}</dd>
        </div>
      ))}
    </dl>
  );
}
