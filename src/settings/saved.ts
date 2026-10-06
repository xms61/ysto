// The host's saved setups (docs/product-specs/settings.md): up to eight lobby settings under a name, on this
// device. A setup saved under another catalog or an older version may name what this lobby can't offer, so
// loading one fits it to the lobby's bounds field by field and says what changed.
import { defaultSettings, validateSettings } from '../../shared/settings.ts';
import type { LobbySettings, Range, SettingsBounds } from '../../shared/settings.ts';
import { isRecord } from '../../shared/validate.ts';
import { readJson, writeItem } from '../storage.ts';

export interface SavedSetup {
  name: string;
  settings: unknown; // as saved; fitted to a lobby's bounds when loaded
}

export const MAX_SETUPS = 8;
export const MAX_SETUP_NAME = 30;

// Released storage keys are permanent.
const SETUPS_KEY = 'ysto_saved_settings';

export function readSetups(storage: Storage | null): SavedSetup[] {
  const stored = readJson(storage, SETUPS_KEY);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((item): item is { name: string; settings: unknown } => isRecord(item) && typeof item.name === 'string')
    .map(({ name, settings }) => ({ name: name.slice(0, MAX_SETUP_NAME), settings }))
    .slice(0, MAX_SETUPS);
}

// Saving under a name that exists replaces that setup; a ninth name pushes out the oldest.
export function saveSetup(storage: Storage | null, setups: SavedSetup[], setup: SavedSetup): SavedSetup[] {
  const next = [setup, ...setups.filter((saved) => saved.name !== setup.name)].slice(0, MAX_SETUPS);
  writeItem(storage, SETUPS_KEY, JSON.stringify(next));
  return next;
}

export function deleteSetup(storage: Storage | null, setups: SavedSetup[], name: string): SavedSetup[] {
  const next = setups.filter((saved) => saved.name !== name);
  writeItem(storage, SETUPS_KEY, JSON.stringify(next));
  return next;
}

function clampRange(value: unknown, bounds: Range): unknown {
  if (!isRecord(value) || typeof value.from !== 'number' || typeof value.to !== 'number') return value;
  const from = Math.min(Math.max(value.from, bounds.from), bounds.to);
  return { from, to: Math.min(Math.max(value.to, from), bounds.to) };
}

const FIELD_NAMES: Record<keyof LobbySettings, string> = {
  sampleLengthSec: 'the sample length',
  songsPerGame: 'the number of songs',
  years: 'the years',
  genres: 'the genres',
  kinds: 'openings and endings',
  formats: 'the formats',
  difficulty: 'the difficulty',
  popularityRanks: 'the popularity ranks',
  sampleStart: 'where samples start',
  scoring: 'the scoring',
  answerChanges: 'answer changes',
  overtimeSec: 'the overtime',
  endless: 'endless play',
  hints: 'hints',
};

// The setup as this lobby can play it, and what had to change: genres the catalog doesn't offer drop out,
// ranges narrow to the catalog's, and any other field the lobby can't take goes back to its default.
export function fitSetup(saved: unknown, bounds: SettingsBounds): { settings: LobbySettings; changes: string[] } {
  const defaults = defaultSettings(bounds);
  const record = isRecord(saved) ? saved : {};
  const changes: string[] = [];
  const fitted: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof LobbySettings)[]) {
    let value = record[key];
    if (value === undefined) continue;
    if (key === 'genres' && Array.isArray(value)) {
      const kept = value.filter((genre) => bounds.genres.includes(genre));
      if (kept.length < value.length) changes.push(`Genres this catalog doesn't offer were dropped.`);
      value = kept;
    }
    if (key === 'years') value = clampRange(value, bounds.years);
    if (key === 'popularityRanks') value = clampRange(value, { from: 1, to: bounds.maxRank });
    if (validateSettings({ ...defaults, [key]: value }, bounds)) {
      if ((key === 'years' || key === 'popularityRanks') && JSON.stringify(value) !== JSON.stringify(record[key])) {
        changes.push(`${FIELD_NAMES[key]} were narrowed to what this catalog has.`);
      }
      fitted[key] = value;
    } else {
      changes.push(`${FIELD_NAMES[key]} went back to the default.`);
    }
  }
  const settings = validateSettings(fitted, bounds) ?? defaults;
  const sentences = changes.map((change) => change.charAt(0).toUpperCase() + change.slice(1));
  return { settings, changes: [...new Set(sentences)] };
}
